const mathAbs = Math.abs;
const mathCos = Math.cos;
const mathSin = Math.sin;
const mathPow = Math.pow;
const mathSqrt = Math.sqrt;

module.exports = function (id, sid, config, utils, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
	this.id = id;
	this.sid = sid;
	this.tmpScore = 0;
	this.team = null;
	this.skinIndex = 0;
	this.tailIndex = 0;
	this.skin = null;
	this.tail = null;
	this.primary = null;
	this.primaryVariant = 0;
	this.secondary = null;
	this.secondaryVariant = 0;
	this.hitTime = 0;
	this.tails = {};
	this.skins = {};
	this.points = 0;
	this.dt = 0;
	this.hidden = false;
	this.itemCounts = {};
	this.isPlayer = true;
	this.pps = 0;
	this.moveDir = undefined;
	this.skinRot = 0;
	this.lastPing = 0;
	this.iconIndex = 0;
	this.skinColor = 0;

	for (let i = 0; i < accessories.length; ++i) {
		if (accessories[i].price <= 0) {
			this.tails[accessories[i].id] = 1;
		}
	}

	for (let i = 0; i < hats.length; ++i) {
		if (hats[i].price <= 0) {
			this.skins[hats[i].id] = 1;
		}
	}

	this.spawn = function (moofoll) {
		this.sentTo = {};
		this.active = true;
		this.alive = true;
		this.lockMove = false;
		this.lockDir = false;
		this.minimapCounter = 0;
		this.chatCountdown = 0;
		this.shameCount = 0;
		this.shameTimer = 0;
		this.gathering = 0;
		this.autoGather = 0;
		this.animTime = 0;
		this.animSpeed = 0;
		this.mouseState = 0;
		this.buildIndex = -1;
		this.weaponIndex = 0;
		this.dmgOverTime = {};
		this.noMovTimer = 0;
		this.maxXp = 300;
		this.xp = 0;
		this.age = 1;
		this.kills = 0;
		this.upgrAge = 2;
		this.upgradePoints = 0;
		this.x = 0;
		this.y = 0;
		this.zIndex = 0;
		this.xVel = 0;
		this.yVel = 0;
		this.slowMult = 1;
		this.dir = 0;
		this.dirPlus = 0;
		this.targetDir = 0;
		this.targetAngle = 0;
		this.maxHealth = 100;
		this.health = this.maxHealth;
		this.lastDamage = 0;
		this.scale = config.playerScale;
		this.speed = config.playerSpeed;
		this.resetMoveDir();
		this.resetResources(moofoll);
		this.items = [0, 3, 6, 10];
		this.weapons = [0];
		this.shootCount = 0;
		this.weaponXp = [];
		this.reloads = {};
	};

	this.resetMoveDir = function () {
		this.moveDir = undefined;
	};

	this.resetResources = function (moofoll) {
		for (let i = 0; i < config.resourceTypes.length; ++i) {
			this[config.resourceTypes[i]] = moofoll ? 100 : 0;
		}
	};

	this.addItem = function (id) {
		const item = items.list[id];
		if (!item) return false;

		for (let i = 0; i < this.items.length; ++i) {
			if (items.list[this.items[i]].group === item.group) {
				if (this.buildIndex === this.items[i]) {
					this.buildIndex = id;
				}
				this.items[i] = id;
				return true;
			}
		}

		this.items.push(id);
		return true;
	};

	this.setUserData = function (data) {
		if (!data) return;

		this.name = "unknown";

		let name = data.name + "";
		name = name.slice(0, config.maxNameLength);
		name = name.replace(/[^\w:\(\)\/? -]+/gim, " ");
		name = name.replace(/[^\x00-\x7F]/g, " ");
		name = name.trim();

		if (name.length > 0) {
			this.name = name;
		}

		this.skinColor = 0;
		if (config.skinColors[data.skin]) {
			this.skinColor = data.skin;
		}
	};

	this.getData = function () {
		return [
			this.id,
			this.sid,
			this.name,
			utils.fixTo(this.x, 2),
			utils.fixTo(this.y, 2),
			utils.fixTo(this.dir, 3),
			this.health,
			this.maxHealth,
			this.scale,
			this.skinColor
		];
	};

	this.setData = function (data) {
		this.id = data[0];
		this.sid = data[1];
		this.name = data[2];
		this.x = data[3];
		this.y = data[4];
		this.dir = data[5];
		this.health = data[6];
		this.maxHealth = data[7];
		this.scale = data[8];
		this.skinColor = data[9];
	};

	let timerCount = 0;

	this.update = function (delta) {
		if (!this.alive) return;

		if (this.shameTimer > 0) {
			this.shameTimer -= delta;
			if (this.shameTimer <= 0) {
				this.shameTimer = 0;
				this.shameCount = 0;
			}
		}

		timerCount -= delta;
		if (timerCount <= 0) {
			const regen = (this.skin && this.skin.healthRegen ? this.skin.healthRegen : 0) + (this.tail && this.tail.healthRegen ? this.tail.healthRegen : 0);
			if (regen) this.changeHealth(regen, this);

			if (this.skin && this.skin.pps) {
				this.addResource(3, this.skin.pps);
			}

			if (this.dmgOverTime.dmg) {
				this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
				this.dmgOverTime.time -= 1;
				if (this.dmgOverTime.time <= 0) {
					this.dmgOverTime.dmg = 0;
				}
			}

			if (this.healCol) {
				this.changeHealth(this.healCol, this);
			}

			timerCount = 1000;
		}

		if (!this.alive) return;

		if (this.slowMult < 1) {
			this.slowMult += 0.0008 * delta;
			if (this.slowMult > 1) this.slowMult = 1;
		}

		if (mathAbs(this.xVel) > 0.01 || mathAbs(this.yVel) > 0.01) {
			this.noMovTimer = 0;
		} else {
			this.noMovTimer += delta;
		}

		if (this.lockMove) {
			this.xVel = 0;
			this.yVel = 0;
		} else {
			let spdMult = (this.buildIndex >= 0 ? 0.5 : 1) *
				(items.weapons[this.weaponIndex].spdMult || 1) *
				(this.skin ? this.skin.spdMult || 1 : 1) *
				(this.tail ? this.tail.spdMult || 1 : 1) *
				(this.y <= config.snowBiomeTop ? (this.skin && this.skin.coldM ? 1 : config.snowSpeed) : 1) *
				this.slowMult;

			if (!this.zIndex) {
				const riverStart = config.mapScale / 2 - config.riverWidth / 2;
				const riverEnd = config.mapScale / 2 + config.riverWidth / 2;
				if (this.y >= riverStart && this.y <= riverEnd) {
					if (this.skin && this.skin.watrImm) {
						spdMult *= 0.75;
						this.xVel += config.waterCurrent * 0.4 * delta;
					} else {
						spdMult *= 0.33;
						this.xVel += config.waterCurrent * delta;
					}
				}
			}

			if (this.moveDir !== null && this.moveDir !== undefined) {
				const xVel = Math.cos(this.moveDir);
				const yVel = Math.sin(this.moveDir);
				const length = Math.sqrt(xVel * xVel + yVel * yVel);

				if (length !== 0) {
					const normX = xVel / length;
					const normY = yVel / length;
					this.xVel += normX * this.speed * spdMult * delta;
					this.yVel += normY * this.speed * spdMult * delta;
				}
			}
		}

		this.zIndex = 0;
		this.lockMove = false;
		this.healCol = 0;

		const tmpSpeed = utils.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
		const depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
		const tMlt = 1 / depth;

		for (let i = 0; i < depth; ++i) {
			if (this.xVel) this.x += this.xVel * delta * tMlt;
			if (this.yVel) this.y += this.yVel * delta * tMlt;

			const grid = objectManager.getGridArrays(this.x, this.y, this.scale);
			const visited = [];

			for (let x = 0; x < grid.length; ++x) {
				for (let y = 0; y < grid[x].length; ++y) {
					const obj = grid[x][y];
					if (obj.active && !visited.includes(obj.sid)) {
						visited.push(obj.sid);
						objectManager.checkCollision(this, obj, tMlt);
					}
				}
			}
		}

		const index = players.indexOf(this);
		for (let i = index + 1; i < players.length; ++i) {
			if (players[i] !== this && players[i].alive && !(this.spectator || players[i].spectator)) {
				objectManager.checkCollision(this, players[i]);
			}
		}

		if (this.xVel) this.xVel *= mathPow(config.playerDecel, delta);
		if (this.yVel) this.yVel *= mathPow(config.playerDecel, delta);

		const scale = this.scale;
		if (this.x - scale < 0) this.x = scale;
		else if (this.x + scale > config.mapScale) this.x = config.mapScale - scale;

		if (this.y - scale < 0) this.y = scale;
		else if (this.y + scale > config.mapScale) this.y = config.mapScale - scale;

		if (this.buildIndex < 0) {
			if (this.reloads[this.weaponIndex] > 0) {
				this.reloads[this.weaponIndex] -= delta;
				this.gathering = this.mouseState;
			} else if (this.gathering || this.autoGather) {
				let worked = true;

				if (items.weapons[this.weaponIndex].gather !== undefined) {
					this.gather(players);
				} else if (items.weapons[this.weaponIndex].projectile !== undefined && this.hasRes(items.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0)) {
					this.useRes(items.weapons[this.weaponIndex], this.skin ? this.skin.projCost : 0);
					this.noMovTimer = 0;

					const projIndex = items.weapons[this.weaponIndex].projectile;
					const projOffset = this.scale * 2;
					const aMlt = this.skin && this.skin.aMlt ? this.skin.aMlt : 1;

					if (items.weapons[this.weaponIndex].rec) {
						this.xVel -= items.weapons[this.weaponIndex].rec * mathCos(this.dir);
						this.yVel -= items.weapons[this.weaponIndex].rec * mathSin(this.dir);
					}

					projectileManager.addProjectile(
						this.x + projOffset * mathCos(this.dir),
						this.y + projOffset * mathSin(this.dir),
						this.dir,
						items.projectiles[projIndex].range * aMlt,
						items.projectiles[projIndex].speed * aMlt,
						projIndex,
						this,
						null,
						this.zIndex
					);
				} else {
					worked = false;
				}

				this.gathering = this.mouseState;
				if (worked) {
					this.reloads[this.weaponIndex] = items.weapons[this.weaponIndex].speed * (this.skin ? this.skin.atkSpd || 1 : 1);
				}
			}
		}
	};

	this.addWeaponXp = function (amount) {
		if (!this.weaponXp[this.weaponIndex]) {
			this.weaponXp[this.weaponIndex] = 0;
		}
		this.weaponXp[this.weaponIndex] += amount;
	};

	this.earnXp = function (amount) {
		if (this.age >= config.maxAge) return;

		this.xp += amount;

		if (this.xp >= this.maxXp) {
			if (this.age < config.maxAge) {
				this.age++;
				this.xp = 0;
				this.maxXp *= 1.2;
			} else {
				this.xp = this.maxXp;
			}

			this.upgradePoints++;
			server.send(this.id, "16", [this.upgradePoints, this.upgrAge]);
			server.send(this.id, "15", [this.xp, utils.fixTo(this.maxXp, 1), this.age]);
		} else {
			server.send(this.id, "15", [this.xp]);
		}
	};

	this.setAge = function (targetAge) {
		const levels = Math.min(targetAge, config.maxAge) - this.age;
		if (levels <= 0) return;

		for (let i = 0; i < levels; i++) {
			this.age++;
			this.xp = 0;
			this.maxXp *= 1.2;
			this.upgradePoints++;
		}

		server.send(this.id, "16", [this.upgradePoints, this.upgrAge]);
		server.send(this.id, "15", [this.xp, utils.fixTo(this.maxXp, 1), this.age]);
	};

	this.changeHealth = function (amount, doer) {
		if (this.spectator && amount < 0) return false;
		if (amount > 0 && this.health >= this.maxHealth) return false;

		if (amount < 0 && this.skin) amount *= this.skin.dmgMult || 1;
		if (amount < 0 && this.tail) amount *= this.tail.dmgMult || 1;
		if (amount < 0) this.hitTime = Date.now();

		this.health += amount;

		if (this.health > this.maxHealth) {
			amount -= this.health - this.maxHealth;
			this.health = this.maxHealth;
		}

		if (this.health <= 0) this.kill(doer);

		for (let i = 0; i < players.length; ++i) {
			if (this.sentTo[players[i].id]) {
				server.send(players[i].id, "h", [this.sid, Math.round(this.health)]);
			}
		}

		if (doer && !(doer === this && amount < 0)) {
			server.send(doer.id, "t", [Math.round(this.x), Math.round(this.y), Math.round(-amount), 1]);
		}

		return true;
	};

	this.kill = function (doer) {
		if (!this.alive) return;

		this.alive = false;

		if (doer && doer.alive) {
			doer.kills++;

			if (doer.skin && doer.skin.goldSteal) {
				scoreCallback(doer, Math.round(this.points / 2));
			} else {
				const mult = doer.skin && doer.skin.kScrM ? doer.skin.kScrM : 1;
				scoreCallback(doer, Math.round(this.age * 100 * mult));
			}

			server.send(doer.id, "9", ["kills", doer.kills, 1]);
		}

		server.send(this.id, "11");
		iconCallback();
	};

	this.addResource = function (type, amount, auto) {
		if (!auto && amount > 0) {
			this.addWeaponXp(amount);
		}

		if (type === 3) {
			scoreCallback(this, amount, true);
		} else {
			this[config.resourceTypes[type]] += amount;
			server.send(this.id, "9", [config.resourceTypes[type], this[config.resourceTypes[type]], 1]);
		}
	};

	this.changeItemCount = function (index, value) {
		this.itemCounts[index] = this.itemCounts[index] || 0;
		this.itemCounts[index] += value;
		server.send(this.id, "14", [index, this.itemCounts[index]]);
	};

	this.changeItemAllCount = function (index, value) {
		this.itemCounts[index] = value;
		server.send(this.id, "14", [index, this.itemCounts[index]]);
	};

	this.buildItem = function (item) {
		const tmpS = this.scale + item.scale + (item.placeOffset || 0);
		const tmpX = this.x + tmpS * mathCos(this.dir);
		const tmpY = this.y + tmpS * mathSin(this.dir);

		if (!this.canBuild(item)) return;
		if (item.consume && this.skin && this.skin.noEat) return;

		const canPlace = item.consume || objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false, this);
		if (!canPlace) return;

		let worked = false;

		if (item.consume) {
			if (this.hitTime) {
				const timeSinceHit = Date.now() - this.hitTime;
				this.hitTime = 0;

				if (timeSinceHit <= 120) {
					this.shameCount++;
					if (this.shameCount >= 10) {
						this.shameTimer = 30000;
						this.shameCount = 0;
					}
				} else {
					this.shameCount -= 2;
					if (this.shameCount < 0) this.shameCount = 0;
				}
			}

			if (this.shameTimer <= 0) {
				worked = item.consume(this);
			}
		} else {
			worked = true;

			if (item.group.limit) {
				this.changeItemCount(item.group.id, 1);
			}

			if (item.pps) {
				this.pps += item.pps;
			}

			objectManager.add(objectManager.objects.length, tmpX, tmpY, this.dir, item.scale, item.type, item, false, this);
		}

		if (worked) {
			this.useRes(item);
			this.buildIndex = -1;
		}
	};

	this.hasRes = function (item, mult) {
		for (let i = 0; i < item.req.length; i += 2) {
			const required = Math.round(item.req[i + 1] * (mult || 1));
			if (this[item.req[i]] < required) return false;
		}
		return true;
	};

	this.useRes = function (item, mult) {
		if (config.inSandbox) return;

		for (let i = 0; i < item.req.length; i += 2) {
			const amount = -Math.round(item.req[i + 1] * (mult || 1));
			this.addResource(config.resourceTypes.indexOf(item.req[i]), amount);
		}
	};

	this.canBuild = function (item) {
		if (config.inSandbox) {
			const sandboxLimits = {
				1: 99,  // walls
				2: 99,  // spikes
				3: 99,  // mills
				4: 99,  // mines
				5: 99,  // traps
				6: 99,  // boosters
				7: 9,  // turrets
				8: 99,  // platform
				9: 99,  // buffs?
				10: 99, // spawn pads
				11: 99, // saplings
				12: 99, // blockers
				13: 99  // teleporters
			};

			if (sandboxLimits[item.group.id] && this.itemCounts[item.group.id] >= sandboxLimits[item.group.id]) {
				return false;
			}
			return true;
		}

		if (item.group.limit && this.itemCounts[item.group.id] >= item.group.limit) {
			return false;
		}
		return this.hasRes(item);
	};

	this.gather = function () {
		this.noMovTimer = 0;

		this.slowMult -= items.weapons[this.weaponIndex].hitSlow || 0.3;
		if (this.slowMult < 0) this.slowMult = 0;

		const variant = config.fetchVariant(this);
		const applyPoison = variant.poison;
		const variantDmg = variant.val;

		const hitObjs = {};
		let hitSomething = false;

		const grid = objectManager.getGridArrays(this.x, this.y, items.weapons[this.weaponIndex].range);

		if (config.canHitObj) {
			for (let t = 0; t < grid.length; ++t) {
				for (let i = 0; i < grid[t].length; ++i) {
					const obj = grid[t][i];
					if (!obj.active || obj.dontGather || hitObjs[obj.sid] || !obj.visibleToPlayer(this)) continue;

					const dist = utils.getDistance(this.x, this.y, obj.x, obj.y) - obj.scale;
					if (dist > items.weapons[this.weaponIndex].range) continue;

					const dir = utils.getDirection(obj.x, obj.y, this.x, this.y);
					if (utils.getAngleDist(dir, this.dir) > config.gatherAngle) continue;

					hitObjs[obj.sid] = 1;

					if (obj.health) {
						const dmg = -items.weapons[this.weaponIndex].dmg * variantDmg *
							(items.weapons[this.weaponIndex].sDmg || 1) *
							(this.skin && this.skin.bDmg ? this.skin.bDmg : 1);

						if (obj.changeHealth(dmg, this)) {
							for (let x = 0; x < obj.req.length; x += 2) {
								this.addResource(config.resourceTypes.indexOf(obj.req[x]), obj.req[x + 1]);
							}
							objectManager.disableObj(obj);
							server.sendAll("12", [obj.sid]);
						}
					} else {
						this.earnXp(4 * items.weapons[this.weaponIndex].gather);

						let count = items.weapons[this.weaponIndex].gather;
						if (obj.type === 3) count += 4;

						if (this.skin && this.skin.extraGold) {
							this.addResource(3, 1);
						}

						this.addResource(obj.type, count);
					}

					hitSomething = true;
					objectManager.hitObj(obj, dir);
				}
			}
		}

		for (let i = 0; i < players.length + ais.length; ++i) {
			const target = players[i] || ais[i - players.length];
			if (!target || target === this || !target.alive || target.spectator) continue;
			if (target.team && target.team === this.team) continue;

			const dist = utils.getDistance(this.x, this.y, target.x, target.y) - target.scale * 1.8;
			if (dist > items.weapons[this.weaponIndex].range) continue;

			const dir = utils.getDirection(target.x, target.y, this.x, this.y);
			if (utils.getAngleDist(dir, this.dir) > config.gatherAngle) continue;

			const steal = items.weapons[this.weaponIndex].steal;
			if (steal && target.addResource) {
				const amount = Math.min(target.points || 0, steal);
				this.addResource(3, amount);
				target.addResource(3, -amount);
			}

			let dmgMlt = variantDmg;
			if (target.weaponIndex !== undefined &&
				items.weapons[target.weaponIndex].shield &&
				utils.getAngleDist(dir + Math.PI, target.dir) <= config.shieldAngle) {
				dmgMlt = items.weapons[target.weaponIndex].shield;
			}

			const dmgVal = this.customDmg ||
				items.weapons[this.weaponIndex].dmg *
				(this.skin && this.skin.dmgMultO ? this.skin.dmgMultO : 1) *
				(this.tail && this.tail.dmgMultO ? this.tail.dmgMultO : 1);

			const knock = 0.3 * (target.weightM || 1) + (items.weapons[this.weaponIndex].knock || 0);

			target.xVel += knock * mathCos(dir);
			target.yVel += knock * mathSin(dir);

			if (this.skin && this.skin.healD) {
				this.changeHealth(dmgVal * dmgMlt * this.skin.healD, this);
			}

			if (this.tail && this.tail.healD) {
				this.changeHealth(dmgVal * dmgMlt * this.tail.healD, this);
			}

			if (target.skin && target.skin.dmg && dmgMlt === 1) {
				this.changeHealth(-dmgVal * target.skin.dmg, target);
			}

			if (target.tail && target.tail.dmg && dmgMlt === 1) {
				this.changeHealth(-dmgVal * target.tail.dmg, target);
			}

			if (target.dmgOverTime && this.skin && this.skin.poisonDmg && !(target.skin && target.skin.poisonRes)) {
				target.dmgOverTime.dmg = this.skin.poisonDmg;
				target.dmgOverTime.time = this.skin.poisonTime || 1;
				target.dmgOverTime.doer = this;
			}

			if (target.dmgOverTime && applyPoison && !(target.skin && target.skin.poisonRes)) {
				target.dmgOverTime.dmg = 5;
				target.dmgOverTime.time = 5;
				target.dmgOverTime.doer = this;
			}

			if (target.skin && target.skin.dmgK) {
				this.xVel -= target.skin.dmgK * mathCos(dir);
				this.yVel -= target.skin.dmgK * mathSin(dir);
			}

			target.changeHealth(-dmgVal * dmgMlt, this, this);
		}

		this.sendAnimation(hitSomething ? 1 : 0);
	};

	this.sendAnimation = function (hit) {
		for (let i = 0; i < players.length; ++i) {
			if (this.sentTo[players[i].id] && players[i].canSee(this)) {
				server.send(players[i].id, "7", [this.sid, hit ? 1 : 0, this.weaponIndex]);
			}
		}
	};

	let tmpRatio = 0;
	let animIndex = 0;

	this.animate = function (delta) {
		if (this.animTime <= 0) return;

		this.animTime -= delta;

		if (this.animTime <= 0) {
			this.animTime = 0;
			this.dirPlus = 0;
			tmpRatio = 0;
			animIndex = 0;
		} else if (animIndex === 0) {
			tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
			this.dirPlus = utils.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
			if (tmpRatio >= 1) {
				tmpRatio = 1;
				animIndex = 1;
			}
		} else {
			tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
			this.dirPlus = utils.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
		}
	};

	this.startAnim = function (didHit, index) {
		this.animTime = this.animSpeed = items.weapons[index].speed;
		this.targetAngle = didHit ? -config.hitAngle : -Math.PI;
		tmpRatio = 0;
		animIndex = 0;
	};

	this.canSee = function (other) {
		if (!other) return false;
		if (other.skin && other.skin.invisTimer && other.noMovTimer >= other.skin.invisTimer) return false;

		const dx = Math.abs(other.x - this.x) - other.scale;
		const dy = Math.abs(other.y - this.y) - other.scale;

		return dx <= (config.maxScreenWidth / 2) * 0.75 && dy <= (config.maxScreenHeight / 2) * 0.75;
	};
};