import { Inject, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { PrismaService } from "src/config/prisma.service";

@Injectable()
export class CreateUserService{
    constructor(@Inject() private prisma:PrismaService) {  
    }
    async create(data:User):Promise<void>{
        await this.prisma.user.create({
            data
        })
    }

}