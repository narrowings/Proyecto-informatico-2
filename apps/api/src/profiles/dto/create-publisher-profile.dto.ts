import { PublisherKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { IsNit } from '../nit';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const isCompany = (dto: CreatePublisherProfileDto) => dto.kind === PublisherKind.COMPANY;

// HU-008 CA1 (persona natural) y CA2 (empresa). Los campos de empresa se ignoran para PERSON.
// Como en RegisterDto, IsNotEmpty va al final para que sea la primera validación.
export class CreatePublisherProfileDto {
  @IsEnum(PublisherKind, { message: 'Elige si publicas como persona natural o como empresa' })
  kind!: PublisherKind;

  @Transform(trim)
  @MaxLength(160, { message: 'El nombre admite máximo 160 caracteres' })
  @IsNotEmpty({ message: 'El nombre o la razón social es obligatorio' })
  displayName!: string;

  // Hasta que exista la subida con URL firmada (Sprint 2) se recibe la URL de la foto o el logo.
  @MaxLength(500, { message: 'La URL de la foto admite máximo 500 caracteres' })
  @IsUrl({ require_tld: false }, { message: 'La foto o el logo no es una URL válida' })
  @IsNotEmpty({ message: 'La foto o el logo es obligatorio' })
  photoUrl!: string;

  @Transform(trim)
  @MaxLength(1000, { message: 'La descripción admite máximo 1000 caracteres' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  description!: string;

  @ValidateIf(isCompany)
  @IsNit()
  @IsNotEmpty({ message: 'El NIT es obligatorio' })
  nit?: string;

  @ValidateIf(isCompany)
  @Transform(trim)
  @MaxLength(120, { message: 'El nombre del contacto admite máximo 120 caracteres' })
  @IsNotEmpty({ message: 'El nombre del contacto o representante es obligatorio' })
  contactName?: string;

  @ValidateIf(isCompany)
  @Transform(trim)
  @MaxLength(100, { message: 'El sector admite máximo 100 caracteres' })
  @IsNotEmpty({ message: 'El sector es obligatorio' })
  sector?: string;
}
