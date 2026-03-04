import { BadRequestException, Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { UserRepository } from "../../user/repository/user.repository";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class CreateUserService {
    constructor(private userRepository: UserRepository, private jwtService: JwtService) {
    }
    async create(data: User): Promise<string> {
        const user = await this.userRepository.getUserByEmail(data.email!)
        if (!user) {
            await this.userRepository.createNewUser(data)
        }
        else {
            await this.userRepository.update(
                data.id, data.accessToken!,
            )

        }
        const token = this.jwtService.sign({
            id: data.id,
            email: data.email,
            provider: data.provider
        })
        
        return token
    }
    async updateAfterCreate(id_user:string,data: {push: true, email: true, weekly: true }): Promise<void> {
        const user = await this.userRepository.getUserById(id_user)
        if (!user) {
            throw new BadRequestException('Refaça o procedimento de criação')
        }
        else {
            await this.userRepository.updateAfterCreate(
                id_user, data
            )

        }

    }


}