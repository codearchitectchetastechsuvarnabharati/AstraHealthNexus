import type {
  AstronautData,
  DatasetBundle,
  DatasetKey,
  ISSData,
  MissionData,
  NASAData,
  RocketData,
  SpaceWeatherData
} from '../types/dataset.js';
import { DatasetLoader } from './datasetLoader.js';

export class DatasetService {
  static async getISSData(): Promise<ISSData> {
    return DatasetLoader.loadFile('iss');
  }

  static async getSpaceWeatherData(): Promise<SpaceWeatherData> {
    return DatasetLoader.loadFile('spaceWeather');
  }

  static async getAstronautData(): Promise<AstronautData[]> {
    return DatasetLoader.loadFile('astronauts');
  }

  static async getRocketData(): Promise<RocketData> {
    return DatasetLoader.loadFile('rocket');
  }

  static async getNASAData(): Promise<NASAData> {
    return DatasetLoader.loadFile('nasa');
  }

  static async getMissionData(): Promise<MissionData> {
    return DatasetLoader.loadFile('mission');
  }

  static async getDatasetByKey<K extends DatasetKey>(key: K): Promise<DatasetBundle[K]> {
    return DatasetLoader.loadFile(key);
  }

  static async getAllData(): Promise<DatasetBundle> {
    return DatasetLoader.loadAll();
  }

  static reloadData(): void {
    DatasetLoader.clearCache();
  }
}
