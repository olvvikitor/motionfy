import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';

export const PET_SPECIES = ['gota', 'gato', 'coelho', 'broto'] as const;
export const PET_COLORS = ['menta', 'lilas', 'rosa', 'pessego', 'ceu', 'grafite'] as const;

// Criar ou editar o bichinho (nome, forma e cor).
export class SavePetDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
    @IsString()
    @Length(1, 16, { message: 'O nome precisa ter de 1 a 16 letras.' })
    name!: string;

    @IsIn(PET_SPECIES, { message: 'Forma inválida.' })
    species!: string;

    @IsIn(PET_COLORS, { message: 'Cor inválida.' })
    color!: string;
}
