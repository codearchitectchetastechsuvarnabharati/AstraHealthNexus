import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, rename } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { DatasetLoader, datasetEvents } from "./datasetLoader.js";
import { DatasetService } from "./datasetService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.resolve(__dirname, "../data-files/spaceWeather.json");

let originalText: string;

async function writeJsonAtomically(target: string, value: unknown) {
  const temp = `${target}.scrum15.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(temp, target);
}

describe("SCRUM-15 dataset reload", () => {
  beforeEach(async () => {
    originalText = await readFile(file, "utf8");
    DatasetLoader.clearCache();
    await DatasetLoader.reload();
  });

  afterEach(async () => {
    await writeFile(file, originalText, "utf8");
    await new Promise(resolve => setTimeout(resolve, 700));
    DatasetLoader.clearCache();
    await DatasetLoader.reload();
  });

  test("loads all six supported datasets", async () => {
    const data = await DatasetLoader.loadAll();
    expect(Object.keys(data).sort()).toEqual(["astronauts","iss","mission","nasa","rocket","spaceWeather"].sort());
  });

  test("reload returns modified dataset value", async () => {
    const original = JSON.parse(originalText.replace(/^\uFEFF/, ""));
    const testKp = original.kpIndex + 7;

    await writeJsonAtomically(file, { ...original, kpIndex: testKp });
    await new Promise(resolve => setTimeout(resolve, 700));

    const reloaded = await DatasetLoader.reload();
    expect(reloaded.spaceWeather.kpIndex).toBe(testKp);
  });

  test("datasetsReloaded event is emitted", async () => {
    let received = false;
    const handler = () => { received = true; };
    datasetEvents.once("datasetsReloaded", handler);

    await DatasetLoader.reload();

    expect(received).toBe(true);
  });

  test("DatasetService reads refreshed dataset", async () => {
    const original = JSON.parse(originalText.replace(/^\uFEFF/, ""));
    const testKp = original.kpIndex + 9;

    await writeJsonAtomically(file, { ...original, kpIndex: testKp });
    await new Promise(resolve => setTimeout(resolve, 700));

    await DatasetService.reloadData();
    const refreshed = await DatasetService.getSpaceWeatherData();

    expect(refreshed.kpIndex).toBe(testKp);
  });

  test("all DatasetService methods remain usable after reload", async () => {
    await DatasetLoader.reload();

    expect((await DatasetService.getISSData()).name).toBeTruthy();
    expect((await DatasetService.getSpaceWeatherData()).status).toBeTruthy();
    expect((await DatasetService.getAstronautData()).length).toBeGreaterThan(0);
    expect((await DatasetService.getRocketData()).name).toBeTruthy();
    expect((await DatasetService.getNASAData()).apod.title).toBeTruthy();
    expect((await DatasetService.getMissionData()).missionName).toBeTruthy();
  });

  test("invalid JSON causes reload to fail without replacing valid cached data", async () => {
    const original = JSON.parse(originalText.replace(/^\uFEFF/, ""));

    await writeFile(file, "{ invalid json", "utf8");
    await new Promise(resolve => setTimeout(resolve, 700));

    await expect(DatasetLoader.reload()).rejects.toThrow();

    await writeFile(file, originalText, "utf8");
    await new Promise(resolve => setTimeout(resolve, 700));

    const restored = await DatasetLoader.reload();
    expect(restored.spaceWeather.kpIndex).toBe(original.kpIndex);
  });
});
