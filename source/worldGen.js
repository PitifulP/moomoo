'use strict';

/**
 * WorldGen
 *
 * Handles all map population (trees, rocks, animals, etc.) and the
 * setupServer() reset routine.  Exported as a class so deps only need to
 * be injected once at startup.
 */
class WorldGen {
  /**
   * @param {{
   *   objectManager:     object,
   *   aiManager:         object,
   *   config:            object,
   *   utils:             object,
   *   gameObjects:       any[],
   * }} deps
   */
  constructor({ objectManager, aiManager, config, utils, gameObjects }) {
    this._om = objectManager;
    this._ai = aiManager;
    this._cfg = config;
    this._u = utils;
    this._objs = gameObjects;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Returns true if (x, y) overlaps any existing object by at least minDist. */
  _overlaps(x, y, minDist) {
    for (let i = 0; i < this._objs.length; i++) {
      if (this._u.getDistance(x, y, this._objs[i].x, this._objs[i].y) < minDist) {
        return true;
      }
    }
    return false;
  }

  // ── Placement methods ──────────────────────────────────────────────────────

  addBossArenaStones(stoneCount, stoneScale, xCenter, yCenter) {
    const arenaScale = (stoneScale * stoneCount) / Math.PI;
    for (let i = 0; i <= stoneCount; i++) {
      let x = xCenter + arenaScale * Math.cos((i * 2 * Math.PI) / stoneCount);
      let y = yCenter + arenaScale * Math.sin((i * 2 * Math.PI) / stoneCount);
      let size = this._u.randInt(0, 1);
      if (i === 0) { x -= 175; size = 2; }
      else if (i === stoneCount) { x += 175; size = 2; }
      this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        this._cfg.rockScales[size], 2, null, true, null
      );
    }
  }

  addTree(count) {
    for (let j = 0; j < count; j++) {
      const x = this._u.randFloat(0, this._cfg.mapScale);
      const y = this._u.randInt(0, 1)
        ? this._u.randFloat(0, 6850)
        : this._u.randFloat(7550, 12000);
      const size = this._cfg.treeScales[this._u.randInt(0, 3)];
      if (this._overlaps(x, y, 100 + size)) continue;
      this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        size, 0, null, true, null
      );
    }
  }

  addBush(count) {
    for (let j = 0; j < count; j++) {
      const x = this._u.randFloat(0, this._cfg.mapScale);
      const y = this._u.randInt(0, 1)
        ? this._u.randFloat(0, 6850)
        : this._u.randFloat(7550, 12000);
      const size = this._cfg.bushScales[this._u.randInt(0, 2)];
      if (this._overlaps(x, y, 100 + size)) continue;
      this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        size, 1, null, true, null
      );
    }
  }

  addCacti(count) {
    for (let j = 0; j < count; j++) {
      const x = this._u.randFloat(0, this._cfg.mapScale);
      const y = this._u.randFloat(12000, this._cfg.mapScale);
      const size = this._cfg.bushScales[2];
      if (this._overlaps(x, y, 100 + size)) continue;
      const obj = this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        size, 1, null, true, null
      );
      obj.dmg = 35;
    }
  }

  addStoneGold(count, isStone) {
    for (let j = 0; j < count; j++) {
      const x = this._u.randFloat(0, this._cfg.mapScale);
      const y = this._u.randInt(0, 1)
        ? this._u.randFloat(0, 6850)
        : this._u.randFloat(7550, this._cfg.mapScale);
      const size = this._cfg.rockScales[this._u.randInt(0, 2)];
      if (this._overlaps(x, y, 100 + size)) continue;
      this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        size, isStone ? 2 : 3, null, true, null
      );
    }
  }

  addRiverStone(count) {
    for (let j = 0; j < count; j++) {
      const x = this._u.randFloat(0, this._cfg.mapScale);
      const y = this._u.randFloat(6850, 7550);
      const size = this._cfg.rockScales[this._u.randInt(0, 2)];
      if (this._overlaps(x, y, 100 + size)) continue;
      this._om.add(
        this._om.objects.length, x, y,
        this._u.randFloat(-Math.PI, Math.PI),
        size, 2, null, true, null
      );
    }
  }

  addAnimals() {
    const spawnCfg = {
      COW: 3,
      PIG: 3,
      BULL: 6,
      BULLY: 1,
      WOLF: 6,
      QUACK: 1,
      MOOSTAFA: 1,
      TREASURE: 1,
      MOOFIE: 1,
    };
    const snowBosses = ['MOOSTAFA', 'TREASURE', 'MOOFIE'];
    const names = Object.keys(spawnCfg);

    names.forEach((name, index) => {
      const count = spawnCfg[name];
      const isSnow = snowBosses.includes(name);
      for (let j = 0; j < count; j++) {
        const x = isSnow ? this._cfg.mapScale / 2 : this._u.randFloat(0, this._cfg.mapScale);
        const y = isSnow ? this._cfg.mapScale - this._cfg.snowBiomeTop / 2 : this._u.randFloat(0, this._cfg.mapScale);
        this._ai.spawn(x, y, Math.PI / 2, index);
      }
    });
  }

  /**
   * Populate a fresh map.  Call after resetting all entity arrays.
   */
  populate() {
    this.addBossArenaStones(
      this._cfg.totalRocks - 1,
      this._cfg.rockScales[1],
      this._cfg.mapScale / 2,
      this._cfg.mapScale - this._cfg.snowBiomeTop / 2
    );
    this.addTree(200);
    this.addBush(100);
    this.addCacti(20);
    this.addStoneGold(100, true);
    this.addStoneGold(10, false);
    this.addRiverStone(15);
    this.addAnimals();
  }
}

module.exports = WorldGen;