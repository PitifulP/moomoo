const pi2 = Math.PI * 2;

module.exports = function (sid, objectManager, players, items, utils, config, scoreCallback, server) {
	this.sid = sid;
	this.isAi = true;
	this.nameIndex = utils.randInt(0, config.cowNames.length - 1);

	this.init = function (x, y, dir, index, data) {
		this.x = x;
		this.y = y;
		this.startX = data.fixedSpawn ? x : null;
		this.startY = data.fixedSpawn ? y : null;
		this.xVel = 0;
		this.yVel = 0;
		this.zIndex = 0;
		this.dir = dir;
		this.dirPlus = 0;
		this.index = index;
		this.src = data.src;
		if (data.name) this.name = data.name;
		this.weightM = data.weightM;
		this.speed = data.speed;
		this.killScore = data.killScore;
		this.turnSpeed = data.turnSpeed;
		this.scale = data.scale;
		this.maxHealth = data.health;
		this.leapForce = data.leapForce;
		this.health = this.maxHealth;
		this.chargePlayer = data.chargePlayer;
		this.viewRange = data.viewRange;
		this.drop = data.drop;
		this.dmg = data.dmg;
		this.hostile = data.hostile;
		this.dontRun = data.dontRun;
		this.hitRange = data.hitRange;
		this.hitDelay = data.hitDelay;
		this.hitScare = data.hitScare;
		this.spriteMlt = data.spriteMlt;
		this.nameScale = data.nameScale;
		this.colDmg = data.colDmg;
		this.noTrap = data.noTrap;
		this.spawnDelay = data.spawnDelay;
		this.hitWait = 0;
		this.waitCount = 1000;
		this.moveCount = 0;
		this.targetDir = 0;
		this.active = true;
		this.alive = true;
		this.runFrom = null;
		this.chargeTarget = null;
		this.dmgOverTime = {};
	};

	let timerCount = 0;

	this.update = function (delta) {
		if (!this.active) return;

		if (this.spawnCounter) {
			this.spawnCounter -= delta;
			if (this.spawnCounter <= 0) {
				this.spawnCounter = 0;
				this.x = this.startX || utils.randInt(0, config.mapScale);
				this.y = this.startY || utils.randInt(0, config.mapScale);
			}
			return;
		}

		timerCount -= delta;
		if (timerCount <= 0) {
			if (this.dmgOverTime.dmg) {
				this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
				this.dmgOverTime.time -= 1;
				if (this.dmgOverTime.time <= 0) {
					this.dmgOverTime.dmg = 0;
				}
			}
			timerCount = 1000;
		}

		let charging = false;
		let slowMlt = 1;

		if (!this.zIndex && !this.lockMove) {
			const riverStart = config.mapScale / 2 - config.riverWidth / 2;
			const riverEnd = config.mapScale / 2 + config.riverWidth / 2;
			if (this.y >= riverStart && this.y <= riverEnd) {
				slowMlt = 0.33;
				this.xVel += config.waterCurrent * delta;
			}
		}

		if (this.lockMove) {
			this.xVel = 0;
			this.yVel = 0;
		} else if (this.waitCount > 0) {
			this.waitCount -= delta;
			if (this.waitCount <= 0) {
				if (this.chargePlayer) {
					let target = null;
					let bestDist = Infinity;

					for (let i = 0; i < players.length; ++i) {
						const p = players[i];
						if (p.alive && !p.spectator && !(p.skin && p.skin.bullRepel)) {
							const dist = utils.getDistance(this.x, this.y, p.x, p.y);
							if (dist <= this.viewRange && (!target || dist < bestDist)) {
								bestDist = dist;
								target = p;
							}
						}
					}

					if (target) {
						this.chargeTarget = target;
						this.moveCount = utils.randInt(8000, 12000);
					} else {
						this.moveCount = utils.randInt(1000, 2000);
						this.targetDir = utils.randFloat(-Math.PI, Math.PI);
					}
				} else {
					this.moveCount = utils.randInt(4000, 10000);
					this.targetDir = utils.randFloat(-Math.PI, Math.PI);
				}
			}
		} else if (this.moveCount > 0) {
			let tmpSpd = this.speed * slowMlt;

			if (this.runFrom && this.runFrom.active && !(this.runFrom.isPlayer && !this.runFrom.alive)) {
				this.targetDir = utils.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y);
				tmpSpd *= 1.42;
			} else if (this.chargeTarget && this.chargeTarget.alive) {
				this.targetDir = utils.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y);
				tmpSpd *= 1.75;
				charging = true;
			}

			if (this.hitWait) {
				tmpSpd *= 0.3;
			}

			if (this.dir !== this.targetDir) {
				this.dir %= pi2;
				const netAngle = (this.dir - this.targetDir + pi2) % pi2;
				const amount = Math.min(Math.abs(netAngle - pi2), netAngle, this.turnSpeed * delta);
				const sign = netAngle - Math.PI >= 0 ? 1 : -1;
				this.dir += sign * amount + pi2;
			}

			this.dir %= pi2;
			this.xVel += tmpSpd * delta * Math.cos(this.dir);
			this.yVel += tmpSpd * delta * Math.sin(this.dir);
			this.moveCount -= delta;

			if (this.moveCount <= 0) {
				this.runFrom = null;
				this.chargeTarget = null;
				this.waitCount = this.hostile ? 1500 : utils.randInt(1500, 6000);
			}
		}

		this.zIndex = 0;
		this.lockMove = false;

		const tmpSpeed = utils.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
		const depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
		const tMlt = 1 / depth;

		for (let i = 0; i < depth; ++i) {
			if (this.xVel) this.x += this.xVel * delta * tMlt;
			if (this.yVel) this.y += this.yVel * delta * tMlt;

			const grid = objectManager.getGridArrays(this.x, this.y, this.scale);
			for (let x = 0; x < grid.length; ++x) {
				for (let y = 0; y < grid[x].length; ++y) {
					if (grid[x][y].active) {
						objectManager.checkCollision(this, grid[x][y], tMlt);
					}
				}
			}
		}

		let hitting = false;

		if (this.hitWait > 0) {
			this.hitWait -= delta;
			if (this.hitWait <= 0) {
				hitting = true;
				this.hitWait = 0;

				if (this.leapForce && !utils.randInt(0, 2)) {
					this.xVel += this.leapForce * Math.cos(this.dir);
					this.yVel += this.leapForce * Math.sin(this.dir);
				}

				const grid = objectManager.getGridArrays(this.x, this.y, this.hitRange);
				for (let t = 0; t < grid.length; ++t) {
					for (let x = 0; x < grid[t].length; ++x) {
						const obj = grid[t][x];
						if (obj.health) {
							const dist = utils.getDistance(this.x, this.y, obj.x, obj.y);
							if (dist < obj.scale + this.hitRange) {
								if (obj.changeHealth(-this.dmg * 5)) {
									objectManager.disableObj(obj);
								}
								objectManager.hitObj(obj, utils.getDirection(this.x, this.y, obj.x, obj.y));
							}
						}
					}
				}

				for (let x = 0; x < players.length; ++x) {
					if (players[x].canSee(this)) {
						server.send(players[x].id, "aa", [this.sid]);
					}
				}
			}
		}

		if (charging || hitting) {
			for (let i = 0; i < players.length; ++i) {
				const p = players[i];
				if (!p || !p.alive || p.spectator) continue;

				const dist = utils.getDistance(this.x, this.y, p.x, p.y);

				if (this.hitRange) {
					if (!this.hitWait && dist <= this.hitRange + p.scale) {
						if (hitting) {
							const dir = utils.getDirection(p.x, p.y, this.x, this.y);
							p.changeHealth(-this.dmg);
							p.xVel += 0.6 * Math.cos(dir);
							p.yVel += 0.6 * Math.sin(dir);
							this.runFrom = null;
							this.chargeTarget = null;
							this.waitCount = 3000;
							this.hitWait = !utils.randInt(0, 2) ? 600 : 0;
						} else {
							this.hitWait = this.hitDelay;
						}
					}
				} else if (dist <= this.scale + p.scale) {
					const dir = utils.getDirection(p.x, p.y, this.x, this.y);
					p.changeHealth(-this.dmg);
					p.xVel += 0.55 * Math.cos(dir);
					p.yVel += 0.55 * Math.sin(dir);
				}
			}
		}

		if (this.xVel) this.xVel *= Math.pow(config.playerDecel, delta);
		if (this.yVel) this.yVel *= Math.pow(config.playerDecel, delta);

		const scale = this.scale;

		if (this.x - scale < 0) {
			this.x = scale;
			this.xVel = 0;
		} else if (this.x + scale > config.mapScale) {
			this.x = config.mapScale - scale;
			this.xVel = 0;
		}

		if (this.y - scale < 0) {
			this.y = scale;
			this.yVel = 0;
		} else if (this.y + scale > config.mapScale) {
			this.y = config.mapScale - scale;
			this.yVel = 0;
		}
	};

	this.canSee = function (other) {
		if (!other) return false;
		if (other.skin && other.skin.invisTimer && other.noMovTimer >= other.skin.invisTimer) return false;

		const dx = Math.abs(other.x - this.x) - other.scale;
		const dy = Math.abs(other.y - this.y) - other.scale;

		return dx <= (config.maxScreenWidth / 2) * 0.75 && dy <= (config.maxScreenHeight / 2) * 0.75;
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

	this.startAnim = function () {
		this.animTime = this.animSpeed = 600;
		this.targetAngle = Math.PI * 0.8;
		tmpRatio = 0;
		animIndex = 0;
	};

	this.changeHealth = function (val, doer, runFrom) {
		if (!this.active) return;

		this.health += val;

		if (runFrom) {
			if (this.hitScare && !utils.randInt(0, this.hitScare)) {
				this.runFrom = runFrom;
				this.waitCount = 0;
				this.moveCount = 2000;
			} else if (this.hostile && this.chargePlayer && runFrom.isPlayer) {
				this.chargeTarget = runFrom;
				this.waitCount = 0;
				this.moveCount = 8000;
			} else if (!this.dontRun) {
				this.runFrom = runFrom;
				this.waitCount = 0;
				this.moveCount = 2000;
			}
		}

		if (val < 0 && this.hitRange && utils.randInt(0, 1)) {
			this.hitWait = 500;
		}

		if (doer && doer.canSee(this) && val < 0) {
			server.send(doer.id, "t", [Math.round(this.x), Math.round(this.y), Math.round(-val), 1]);
		}

		if (this.health <= 0) {
			if (this.spawnDelay) {
				this.spawnCounter = this.spawnDelay;
				this.x = -1000000;
				this.y = -1000000;
			} else {
				this.x = this.startX || utils.randInt(0, config.mapScale);
				this.y = this.startY || utils.randInt(0, config.mapScale);
			}

			this.health = this.maxHealth;
			this.runFrom = null;

			if (doer) {
				scoreCallback(doer, this.killScore);
				if (this.drop) {
					for (let i = 0; i < this.drop.length; i += 2) {
						doer.addResource(config.resourceTypes.indexOf(this.drop[i]), this.drop[i + 1]);
					}
				}
			}
		}
	};
};