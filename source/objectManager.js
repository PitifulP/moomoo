const mathFloor = Math.floor;
const mathAbs = Math.abs;
const mathCos = Math.cos;
const mathSin = Math.sin;
const mathSqrt = Math.sqrt;

module.exports = function (gameObject, gameObjects, utils, config, players, server) {
	this.count = 1;
	this.objects = gameObjects;
	this.grids = {};
	this.updateObjects = [];

	const cellSize = config.mapScale / config.colGrid;

	this.setObjectGrids = function (obj) {
		const objX = Math.min(config.mapScale, Math.max(0, obj.x));
		const objY = Math.min(config.mapScale, Math.max(0, obj.y));

		for (let x = 0; x < config.colGrid; ++x) {
			const cellX = x * cellSize;
			for (let y = 0; y < config.colGrid; ++y) {
				const cellY = y * cellSize;

				if (objX + obj.scale >= cellX && objX - obj.scale <= cellX + cellSize &&
					objY + obj.scale >= cellY && objY - obj.scale <= cellY + cellSize) {

					const key = x + "_" + y;
					if (!this.grids[key]) {
						this.grids[key] = [];
					}
					this.grids[key].push(obj);
					obj.gridLocations.push(key);
				}
			}
		}
	};

	this.removeObjGrid = function (obj) {
		for (let i = 0; i < obj.gridLocations.length; ++i) {
			const grid = this.grids[obj.gridLocations[i]];
			if (grid) {
				const index = grid.indexOf(obj);
				if (index >= 0) {
					grid.splice(index, 1);
				}
			}
		}
	};

	this.disableObj = function (obj) {
		obj.active = false;

		if (server) {
			if (obj.owner && obj.pps) {
				obj.owner.pps -= obj.pps;
			}

			this.removeObjGrid(obj);

			const index = this.updateObjects.indexOf(obj);
			if (index >= 0) {
				this.updateObjects.splice(index, 1);
			}
		}
	};

	this.hitObj = function (obj, dir) {
		for (let p = 0; p < players.length; ++p) {
			const player = players[p];
			if (!player.active) continue;

			if (obj.sentTo[player.id]) {
				if (!obj.active) {
					server.send(player.id, "12", [obj.sid]);
				} else if (player.canSee(obj)) {
					server.send(player.id, "8", [utils.fixTo(dir, 1), obj.sid]);
				}
			}

			if (!obj.active && obj.owner === player) {
				player.changeItemCount(obj.group.id, -1);
			}
		}
	};

	this.getGridArrays = function (xPos, yPos, s) {
		const gridX = mathFloor(xPos / cellSize);
		const gridY = mathFloor(yPos / cellSize);
		const result = [];

		try {
			// center
			const centerKey = gridX + "_" + gridY;
			if (this.grids[centerKey]) {
				result.push(this.grids[centerKey]);
			}

			// right
			if (xPos + s >= (gridX + 1) * cellSize) {
				const rightKey = (gridX + 1) + "_" + gridY;
				if (this.grids[rightKey]) {
					result.push(this.grids[rightKey]);
				}

				if (gridY && yPos - s <= gridY * cellSize) {
					// top right
					const topRightKey = (gridX + 1) + "_" + (gridY - 1);
					if (this.grids[topRightKey]) {
						result.push(this.grids[topRightKey]);
					}
				} else if (yPos + s >= (gridY + 1) * cellSize) {
					// bottom right
					const bottomRightKey = (gridX + 1) + "_" + (gridY + 1);
					if (this.grids[bottomRightKey]) {
						result.push(this.grids[bottomRightKey]);
					}
				}
			}

			// left
			if (gridX && xPos - s <= gridX * cellSize) {
				const leftKey = (gridX - 1) + "_" + gridY;
				if (this.grids[leftKey]) {
					result.push(this.grids[leftKey]);
				}

				if (gridY && yPos - s <= gridY * cellSize) {
					// top left
					const topLeftKey = (gridX - 1) + "_" + (gridY - 1);
					if (this.grids[topLeftKey]) {
						result.push(this.grids[topLeftKey]);
					}
				} else if (yPos + s >= (gridY + 1) * cellSize) {
					// bottom left
					const bottomLeftKey = (gridX - 1) + "_" + (gridY + 1);
					if (this.grids[bottomLeftKey]) {
						result.push(this.grids[bottomLeftKey]);
					}
				}
			}

			// bottom
			if (yPos + s >= (gridY + 1) * cellSize) {
				const bottomKey = gridX + "_" + (gridY + 1);
				if (this.grids[bottomKey]) {
					result.push(this.grids[bottomKey]);
				}
			}

			// top
			if (gridY && yPos - s <= gridY * cellSize) {
				const topKey = gridX + "_" + (gridY - 1);
				if (this.grids[topKey]) {
					result.push(this.grids[topKey]);
				}
			}
		} catch (e) { }

		return result;
	};

	this.add = function (sid, x, y, dir, s, type, data, setSid, owner) {
		let obj = null;

		for (let i = 0; i < gameObjects.length; ++i) {
			if (gameObjects[i].sid === sid) {
				obj = gameObjects[i];
				break;
			}
		}

		if (!obj) {
			for (let i = 0; i < gameObjects.length; ++i) {
				if (!gameObjects[i].active) {
					obj = gameObjects[i];
					break;
				}
			}
		}

		if (!obj) {
			obj = new gameObject(sid);
			gameObjects.push(obj);
		}

		if (setSid) {
			obj.sid = sid;
		}

		obj.init(x, y, dir, s, type, data, owner);

		if (server) {
			this.setObjectGrids(obj);
			if (obj.doUpdate) {
				this.updateObjects.push(obj);
			}
		}

		return obj;
	};

	this.disableBySid = function (sid) {
		for (let i = 0; i < gameObjects.length; ++i) {
			if (gameObjects[i].sid === sid) {
				this.disableObj(gameObjects[i]);
				break;
			}
		}
	};

	this.removeAllItems = function (sid, server) {
		for (let i = 0; i < gameObjects.length; ++i) {
			const obj = gameObjects[i];
			if (obj.active && obj.owner && obj.owner.sid === sid) {
				this.disableObj(obj);
			}
		}

		if (server) {
			server.sendAll("13", [sid]);
		}
	};

	this.fetchSpawnObj = function (sid) {
		let location = null;

		for (let i = 0; i < gameObjects.length; ++i) {
			const obj = gameObjects[i];
			if (obj.active && obj.owner && obj.owner.sid === sid && obj.spawnPoint) {
				location = [obj.x, obj.y];
				this.disableObj(obj);
				server.sendAll("12", [obj.sid]);
				if (obj.owner) {
					obj.owner.changeItemCount(obj.group.id, -1);
				}
				break;
			}
		}

		return location;
	};

	this.checkItemLocation = function (x, y, s, sM, index, ignoreWater, placer) {
		for (let i = 0; i < gameObjects.length; ++i) {
			const obj = gameObjects[i];
			const blockSize = obj.blocker ? obj.blocker : obj.getScale(sM, obj.isItem);

			if (obj.active && utils.getDistance(x, y, obj.x, obj.y) < s + blockSize) {
				return false;
			}
		}

		if (!ignoreWater && index !== 18) {
			const riverStart = config.mapScale / 2 - config.riverWidth / 2;
			const riverEnd = config.mapScale / 2 + config.riverWidth / 2;
			if (y >= riverStart && y <= riverEnd) {
				return false;
			}
		}

		return true;
	};

	this.checkCollision = function (player, other, delta) {
		if (player.spectator || (other && other.spectator)) {
			return false;
		}

		delta = delta || 1;

		const dx = player.x - other.x;
		const dy = player.y - other.y;
		let minDistance = player.scale + other.scale;

		if (mathAbs(dx) <= minDistance || mathAbs(dy) <= minDistance) {
			minDistance = player.scale + (other.getScale ? other.getScale() : other.scale);
			let overlap = mathSqrt(dx * dx + dy * dy) - minDistance;

			if (overlap <= 0) {
				if (!other.ignoreCollision) {
					const dir = utils.getDirection(player.x, player.y, other.x, other.y);

					if (other.isPlayer) {
						overlap = (overlap * -1) / 2;
						player.x += overlap * mathCos(dir);
						player.y += overlap * mathSin(dir);
						other.x -= overlap * mathCos(dir);
						other.y -= overlap * mathSin(dir);
					} else {
						player.x = other.x + minDistance * mathCos(dir);
						player.y = other.y + minDistance * mathSin(dir);
						player.xVel *= 0.75;
						player.yVel *= 0.75;
					}

					if (other.dmg && other.owner !== player &&
						!(other.owner && other.owner.team && other.owner.team === player.team)) {

						player.changeHealth(-other.dmg, other.owner, other);

						const speed = 1.5 * (other.weightM || 1);
						player.xVel += speed * mathCos(dir);
						player.yVel += speed * mathSin(dir);

						if (other.pDmg && !(player.skin && player.skin.poisonRes)) {
							player.dmgOverTime.dmg = other.pDmg;
							player.dmgOverTime.time = 5;
							player.dmgOverTime.doer = other.owner;
						}

						if (player.colDmg && other.health) {
							if (other.changeHealth(-player.colDmg)) {
								this.disableObj(other);
							}
							this.hitObj(other, utils.getDirection(player.x, player.y, other.x, other.y));
						}
					}
				} else if (other.trap && !player.noTrap && other.owner !== player &&
					!(other.owner && other.owner.team && other.owner.team === player.team)) {
					player.lockMove = true;
					other.hideFromEnemy = false;
				} else if (other.boostSpeed) {
					player.xVel += delta * other.boostSpeed * (other.weightM || 1) * mathCos(other.dir);
					player.yVel += delta * other.boostSpeed * (other.weightM || 1) * mathSin(other.dir);
				} else if (other.healCol) {
					player.healCol = other.healCol;
				} else if (other.teleport) {
					player.x = utils.randInt(0, config.mapScale);
					player.y = utils.randInt(0, config.mapScale);
				}

				if (other.zIndex > player.zIndex) {
					player.zIndex = other.zIndex;
				}

				return true;
			}
		}

		return false;
	};
};