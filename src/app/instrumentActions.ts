import { instrumentRepo } from '../data/repositories';
import type { Instrument } from '../domain/types';

export async function upsertInstrument(instrument: Instrument): Promise<Instrument> {
  return instrumentRepo.upsert(instrument);
}
