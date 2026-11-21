import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateOpportunityDto } from './create-opportunity.dto';

// HU-023 CA2: se edita todo salvo el tipo. Los campos que no se envían quedan igual; el servicio
// combina el cambio con lo guardado y vuelve a validar la oportunidad completa.
export class UpdateOpportunityDto extends PartialType(OmitType(CreateOpportunityDto, ['type'])) {}
