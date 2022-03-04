import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export default class Event {
    @PrimaryGeneratedColumn()
    eventId : string | undefined;
    @Column()
    maximumVoucher: number | undefined;
    @Column()
    createdTime: Date | undefined;
    @Column()
    updatedTime: Date | undefined;
    @Column()
    deletedTime: Date | undefined;   
    @Column()
    editingName: string | undefined 
}