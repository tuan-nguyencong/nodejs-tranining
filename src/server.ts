'use strict'
import Hapi from '@hapi/hapi'
import { MongoClient } from 'mongodb'
import { Server, ServerRoute } from "@hapi/hapi"
import Agenda from 'agenda'
import Event from './entity/Event'
import { Voucher } from './entity/Voucher'
import { v4 as uuidv4} from 'uuid'


export let server: Server
let databaseClient: MongoClient
let agenda : Agenda
const EVENT_TABLE = "events";
const VOUCHER_TABLE = "vouchers";
const TIME_OUT = 5;
export const init = async function() {
    server = Hapi.server({
        port: 4000,
        host: '0.0.0.0'
    });
    const uri = 'mongodb+srv://hades832:Thucoanh98@cluster0.uostb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority'    
    databaseClient = new MongoClient(uri)
    let routes : ServerRoute[];
    routes = [];
    routes.push({
        method: 'POST',
        path: '/events/{event_id}/voucher',
        handler: async function(request, h) {
            var eventId = request.params.event_id;
            if (!eventId) {
                return h.response({code: 456, message: 'Missing parameter event_id'}).code(456);
            }
            let event = await databaseClient.db().collection(EVENT_TABLE).findOne({eventId : eventId});
            if (!event) {
                return h.response({code: 456, message: `Event ${eventId} not found`}).code(456);
            }
            let vouchersCount = await databaseClient.db().collection(VOUCHER_TABLE).count({eventId: eventId});
            if (vouchersCount >= event.maximumVoucher) {
                return h.response({code: 456, message: `Event ${eventId} has reached maximum vouchers`}).code(456);                
            }
            let voucher = new Voucher();
            voucher.eventId = eventId;
            voucher.voucherDescription = `Voucher for event ${eventId}`;
            voucher.voucherCode = uuidv4();
            await databaseClient.db().collection(VOUCHER_TABLE).insertOne(voucher);
            return h.response({
                data: JSON.stringify(voucher, function(key, value) {
                    if (key == '_id') {
                        return undefined
                    }
                    return value;
                })
            }).code(200);
        }
    });
    
    routes.push({
        method: 'GET',
        path: '/events/all',
        handler: async function(request, h) {
            let eventsList = databaseClient.db().collection(EVENT_TABLE).find();
            let events = await eventsList.toArray();
            return h.response({
                data: JSON.stringify(events, function (key, value) {
                    if (key == '_id'){
                        return undefined;
                    }
                    return value;
                })
            }).code(200);
        }
    });
    routes.push({
        method: 'POST',
        path: '/events/{event_id}/editable/me',
        handler: async function( request, h) {
            var eventId = request.params.event_id;
            if (!eventId) {
                return h.response({code: 409, message: 'Missing parameter event_id'}).code(409);
            }
            let username = request.payload;            
            let event = await databaseClient.db().collection(EVENT_TABLE).findOne({eventId: eventId});
            if (!event) {
                return h.response({code: 409, message: `Event ${eventId} not found` }).code(409);
            }
            //event is editing, check edit time            
            if (event.editingName && event.editingName != username) {
                let updatedAt = new Date(event.updatedTime);
                let expireTime = new Date();
                expireTime.setTime(updatedAt.getTime() + TIME_OUT * 60 * 1000);                
                //check if editing is expired
                if (new Date() < expireTime) {                    
                    return h.response({code: 409, message: 'Other user is editing this event'}).code(409);
                }
            }
            try {
                event.editingName = username;
                event.updatedTime = new Date();
                await databaseClient.db().collection(EVENT_TABLE).updateOne({_id: event._id}, {$set: event})
            } catch( err) {
                console.log(err);
            }
            return h.response({code: 200, data: "OK"}).code(200);
        }
    });
    
    routes.push({
        method: 'POST',
        path: '/events/{event_id}/editable/release',
        handler: async function(request, h) {
            var eventId = request.params.event_id;
            if (!eventId) {
                return h.response({code: 409, message: 'Missing parameter event_id'}).code(409);
            }
            var event = await databaseClient.db().collection(EVENT_TABLE).findOne({eventId: eventId})
            if (!event) {
                return h.response({code: 409, message: `Event ${eventId} not found` }).code(409);
            }           
            try {
                event.editingName = null;
                event.updatedAt = new Date();
                await databaseClient.db().collection(EVENT_TABLE).updateOne({_id : event._id}, {$set: event})
            }catch(err) {
                console.log(err);
                return h.response({code: 500, message: err }).code(500);
            }
            return h.response({code: 200, data: "OK"}).code(200);
        }
    });

    routes.push({
        method: 'GET',
        path: '/events/{event_id}/editable/maintain',
        handler: async function(request, h) {
            var eventId = request.params.event_id;
            if (!eventId) {
                return h.response({code: 409, message: 'Missing parameter event_id'}).code(409);
            }
            var event = await databaseClient.db().collection(EVENT_TABLE).findOne({eventId: eventId})
            if (!event) {
                return h.response({code: 409, message: `Event ${eventId} not found` }).code(409);
            }           
            if (event.editingName) {
                let editing = event.editingName;
                let updatedAt = new Date(event.updatedTime);
                let expireTime = new Date();
                expireTime.setTime(updatedAt.getTime() + TIME_OUT * 60 * 1000);
                console.log(`update at ${updatedAt} by ${event.editingName}, expired at: ${expireTime}`);
                
                try {
                    event.editingName = null;
                    event.updatedAt = new Date();
                    await databaseClient.db().collection(EVENT_TABLE).updateOne({_id: event._id}, {$set: event})
                } catch( err) {
                    return h.response({code: 500, message: err }).code(500);
                }
                return h.response({code: 200, data: {editing: editing}}).code(200);                
            }
            return h.response({code: 200, data: {editing: undefined}}).code(200);
            
        }
    });
    
    routes.forEach(route => {
        server.route(route);
    });
    return server;
}

export const start =  async function () : Promise<void> {
       
    await databaseClient.connect();
    console.log(`MongoDB connection created`)
    
    agenda = new Agenda({mongo: databaseClient.db()});
    agenda.define('check', async () => {
        console.log(`Connection is OK`);
    })
    agenda.start();
    agenda.every("1 minute", 'check')

    console.log(`Listening on ${server.settings.host}:${server.settings.port}`)
    server.start();            
    
    //dummy data
    let eventCollection = databaseClient.db().collection(EVENT_TABLE);    

    //dummy event
    for (var i = 0; i < 10; i++) {
        let event = new Event();
        event.createdTime = new Date();
        event.updatedTime = new Date();
        event.maximumVoucher = i + 5;
        event.eventId = `${i}`;        
        let dbEvent = await eventCollection.findOne({ eventId: event.eventId });
        if (!dbEvent) {
            eventCollection.insertOne(event);
        }
    }
    
    
}

process.on('unhandledRejection', (err) => {
    console.error("unhandledRejection");
    console.error(err);
    process.exit(1);
});
