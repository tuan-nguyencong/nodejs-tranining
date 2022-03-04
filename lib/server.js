'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = exports.init = exports.server = void 0;
const hapi_1 = __importDefault(require("@hapi/hapi"));
const mongodb_1 = require("mongodb");
const agenda_1 = __importDefault(require("agenda"));
const Event_1 = __importDefault(require("./entity/Event"));
const Voucher_1 = require("./entity/Voucher");
const uuid_1 = require("uuid");
let databaseClient;
let agenda;
const EVENT_TABLE = "events";
const VOUCHER_TABLE = "vouchers";
const TIME_OUT = 5;
const init = function () {
    return __awaiter(this, void 0, void 0, function* () {
        exports.server = hapi_1.default.server({
            port: 4000,
            host: '0.0.0.0'
        });
        const uri = 'mongodb+srv://hades832:Thucoanh98@cluster0.uostb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority';
        databaseClient = new mongodb_1.MongoClient(uri);
        let routes;
        routes = [];
        routes.push({
            method: 'POST',
            path: '/events/{event_id}/voucher',
            handler: function (request, h) {
                return __awaiter(this, void 0, void 0, function* () {
                    var eventId = request.params.event_id;
                    if (!eventId) {
                        return h.response({ code: 456, message: 'Missing parameter event_id' }).code(456);
                    }
                    let event = yield databaseClient.db().collection(EVENT_TABLE).findOne({ eventId: eventId });
                    if (!event) {
                        return h.response({ code: 456, message: `Event ${eventId} not found` }).code(456);
                    }
                    let vouchersCount = yield databaseClient.db().collection(VOUCHER_TABLE).count({ eventId: eventId });
                    if (vouchersCount >= event.maximumVoucher) {
                        return h.response({ code: 456, message: `Event ${eventId} has reached maximum vouchers` }).code(456);
                    }
                    let voucher = new Voucher_1.Voucher();
                    voucher.eventId = eventId;
                    voucher.voucherDescription = `Voucher for event ${eventId}`;
                    voucher.voucherCode = (0, uuid_1.v4)();
                    yield databaseClient.db().collection(VOUCHER_TABLE).insertOne(voucher);
                    return h.response({
                        data: JSON.stringify(voucher, function (key, value) {
                            if (key == '_id') {
                                return undefined;
                            }
                            return value;
                        })
                    }).code(200);
                });
            }
        });
        routes.push({
            method: 'GET',
            path: '/events/all',
            handler: function (request, h) {
                return __awaiter(this, void 0, void 0, function* () {
                    let eventsList = databaseClient.db().collection(EVENT_TABLE).find();
                    let events = yield eventsList.toArray();
                    return h.response({
                        data: JSON.stringify(events, function (key, value) {
                            if (key == '_id') {
                                return undefined;
                            }
                            return value;
                        })
                    }).code(200);
                });
            }
        });
        routes.push({
            method: 'POST',
            path: '/events/{event_id}/editable/me',
            handler: function (request, h) {
                return __awaiter(this, void 0, void 0, function* () {
                    var eventId = request.params.event_id;
                    if (!eventId) {
                        return h.response({ code: 409, message: 'Missing parameter event_id' }).code(409);
                    }
                    let username = request.payload;
                    let event = yield databaseClient.db().collection(EVENT_TABLE).findOne({ eventId: eventId });
                    if (!event) {
                        return h.response({ code: 409, message: `Event ${eventId} not found` }).code(409);
                    }
                    //event is editing, check edit time            
                    if (event.editingName && event.editingName != username) {
                        let updatedAt = new Date(event.updatedTime);
                        let expireTime = new Date();
                        expireTime.setTime(updatedAt.getTime() + TIME_OUT * 60 * 1000);
                        //check if editing is expired
                        if (new Date() < expireTime) {
                            return h.response({ code: 409, message: 'Other user is editing this event' }).code(409);
                        }
                    }
                    try {
                        event.editingName = username;
                        event.updatedTime = new Date();
                        yield databaseClient.db().collection(EVENT_TABLE).updateOne({ _id: event._id }, { $set: event });
                    }
                    catch (err) {
                        console.log(err);
                    }
                    return h.response({ code: 200, data: "OK" }).code(200);
                });
            }
        });
        routes.push({
            method: 'POST',
            path: '/events/{event_id}/editable/release',
            handler: function (request, h) {
                return __awaiter(this, void 0, void 0, function* () {
                    var eventId = request.params.event_id;
                    if (!eventId) {
                        return h.response({ code: 409, message: 'Missing parameter event_id' }).code(409);
                    }
                    var event = yield databaseClient.db().collection(EVENT_TABLE).findOne({ eventId: eventId });
                    if (!event) {
                        return h.response({ code: 409, message: `Event ${eventId} not found` }).code(409);
                    }
                    try {
                        event.editingName = null;
                        event.updatedAt = new Date();
                        yield databaseClient.db().collection(EVENT_TABLE).updateOne({ _id: event._id }, { $set: event });
                    }
                    catch (err) {
                        console.log(err);
                        return h.response({ code: 500, message: err }).code(500);
                    }
                    return h.response({ code: 200, data: "OK" }).code(200);
                });
            }
        });
        routes.push({
            method: 'GET',
            path: '/events/{event_id}/editable/maintain',
            handler: function (request, h) {
                return __awaiter(this, void 0, void 0, function* () {
                    var eventId = request.params.event_id;
                    if (!eventId) {
                        return h.response({ code: 409, message: 'Missing parameter event_id' }).code(409);
                    }
                    var event = yield databaseClient.db().collection(EVENT_TABLE).findOne({ eventId: eventId });
                    if (!event) {
                        return h.response({ code: 409, message: `Event ${eventId} not found` }).code(409);
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
                            yield databaseClient.db().collection(EVENT_TABLE).updateOne({ _id: event._id }, { $set: event });
                        }
                        catch (err) {
                            return h.response({ code: 500, message: err }).code(500);
                        }
                        return h.response({ code: 200, data: { editing: editing } }).code(200);
                    }
                    return h.response({ code: 200, data: { editing: undefined } }).code(200);
                });
            }
        });
        routes.forEach(route => {
            exports.server.route(route);
        });
        return exports.server;
    });
};
exports.init = init;
const start = function () {
    return __awaiter(this, void 0, void 0, function* () {
        yield databaseClient.connect();
        console.log(`MongoDB connection created`);
        agenda = new agenda_1.default({ mongo: databaseClient.db() });
        agenda.define('check', () => __awaiter(this, void 0, void 0, function* () {
            console.log(`Connection is OK`);
        }));
        agenda.start();
        agenda.every("1 minute", 'check');
        console.log(`Listening on ${exports.server.settings.host}:${exports.server.settings.port}`);
        exports.server.start();
        //dummy data
        let eventCollection = databaseClient.db().collection(EVENT_TABLE);
        //dummy event
        for (var i = 0; i < 10; i++) {
            let event = new Event_1.default();
            event.createdTime = new Date();
            event.updatedTime = new Date();
            event.maximumVoucher = i + 5;
            event.eventId = `${i}`;
            let dbEvent = yield eventCollection.findOne({ eventId: event.eventId });
            if (!dbEvent) {
                eventCollection.insertOne(event);
            }
        }
    });
};
exports.start = start;
process.on('unhandledRejection', (err) => {
    console.error("unhandledRejection");
    console.error(err);
    process.exit(1);
});
