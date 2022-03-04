import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity()
export class Voucher {
    @PrimaryColumn()
    voucherCode: string | undefined;
    @Column()
    eventId: number | undefined;
    @Column()
    voucherDescription: string | undefined;
    @Column()
    createdTime: Date | undefined;
    @Column()
    updatedTime: Date | undefined;
    @Column()
    deletedTime: Date | undefined    
}