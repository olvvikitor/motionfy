import { Injectable } from "@nestjs/common";
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
                data.id, data.spotifyAccessToken, data.spotifyExpiresAt
            )

        }
        const token = this.jwtService.sign({
            id: data.id,
            email: data.email
        })
        return token
    }


}