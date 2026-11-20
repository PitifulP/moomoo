module.exports = function (players, ais, objectManager, items, config, utils, server) {
	this.init = function (index, x, y, dir, speed, dmg, range, scale, owner) {
		this.active = true;
		this.index = index;
		this.x = x;
		this.y = y;
		this.dir = dir;
		this.skipMove = true;
		this.speed = speed;
		this.dmg = dmg;
		this.scale = scale;
		this.range = range;
		this.owner = owner;

		if (server) {
			this.sentTo = {};
		}
	};

	let objectsHit = [];
	let tmpObj;

	this.update = function (delta) {
		if (!this.active) return;

		const moveSpeed = this.speed * delta;

		if (!this.skipMove) {
			this.x += moveSpeed * Math.cos(this.dir);
			this.y += moveSpeed * Math.sin(this.dir);
			this.range -= moveSpeed;

			if (this.range <= 0) {
				this.x += this.range * Math.cos(this.dir);
				this.y += this.range * Math.sin(this.dir);
				this.range = 0;
				this.active = false;
			}
		} else {
			this.skipMove = false;
		}

		if (!server) return;

		for (let i = 0; i < players.length; ++i) {
			const p = players[i];
			if (!this.sentTo[p.id] && p.canSee(this)) {
				this.sentTo[p.id] = 1;
				server.send(p.id, "18", [
					utils.fixTo(this.x, 1),
					utils.fixTo(this.y, 1),
					utils.fixTo(this.dir, 2),
					utils.fixTo(this.range, 1),
					this.speed,
					this.index,
					this.layer,
					this.sid
				]);
			}
		}

		objectsHit.length = 0;

		for (let i = 0; i < players.length + ais.length; ++i) {
			tmpObj = players[i] || ais[i - players.length];

			if (!tmpObj.alive || tmpObj.spectator) continue;
			if (tmpObj === this.owner) continue;
			if (this.owner.team && tmpObj.team === this.owner.team) continue;

			const x1 = tmpObj.x - tmpObj.scale;
			const y1 = tmpObj.y - tmpObj.scale;
			const x2 = tmpObj.x + tmpObj.scale;
			const y2 = tmpObj.y + tmpObj.scale;
			const projX1 = this.x;
			const projY1 = this.y;
			const projX2 = this.x + moveSpeed * Math.cos(this.dir);
			const projY2 = this.y + moveSpeed * Math.sin(this.dir);

			if (utils.lineInRect(x1, y1, x2, y2, projX1, projY1, projX2, projY2)) {
				objectsHit.push(tmpObj);
			}
		}

		const grid = objectManager.getGridArrays(this.x, this.y, this.scale);

		for (let x = 0; x < grid.length; ++x) {
			for (let y = 0; y < grid[x].length; ++y) {
				tmpObj = grid[x][y];
				const objScale = tmpObj.getScale();

				if (!tmpObj.active) continue;
				if (this.ignoreObj === tmpObj.sid) continue;
				if (this.layer > tmpObj.layer) continue;
				if (objectsHit.includes(tmpObj)) continue;
				if (tmpObj.ignoreCollision) continue;

				const x1 = tmpObj.x - objScale;
				const y1 = tmpObj.y - objScale;
				const x2 = tmpObj.x + objScale;
				const y2 = tmpObj.y + objScale;
				const projX1 = this.x;
				const projY1 = this.y;
				const projX2 = this.x + moveSpeed * Math.cos(this.dir);
				const projY2 = this.y + moveSpeed * Math.sin(this.dir);

				if (utils.lineInRect(x1, y1, x2, y2, projX1, projY1, projX2, projY2)) {
					objectsHit.push(tmpObj);
				}
			}
		}

		if (objectsHit.length === 0) return;

		let hitObj = null;
		let shortestDist = null;

		for (let i = 0; i < objectsHit.length; ++i) {
			const dist = utils.getDistance(this.x, this.y, objectsHit[i].x, objectsHit[i].y);
			if (shortestDist === null || dist < shortestDist) {
				shortestDist = dist;
				hitObj = objectsHit[i];
			}
		}

		if (hitObj.isPlayer || hitObj.isAi) {
			const knockback = 0.3 * (hitObj.weightM || 1);
			hitObj.xVel += knockback * Math.cos(this.dir);
			hitObj.yVel += knockback * Math.sin(this.dir);

			const hasShield = hitObj.weaponIndex !== undefined &&
				items.weapons[hitObj.weaponIndex].shield &&
				utils.getAngleDist(this.dir + Math.PI, hitObj.dir) <= config.shieldAngle;

			if (!hasShield) {
				hitObj.changeHealth(-this.dmg, this.owner, this.owner);
			}
		} else {
			if (hitObj.projDmg && hitObj.health && hitObj.changeHealth(-this.dmg)) {
				objectManager.disableObj(hitObj);
			}

			for (let i = 0; i < players.length; ++i) {
				const p = players[i];
				if (!p.active) continue;

				if (hitObj.sentTo[p.id]) {
					if (hitObj.active) {
						if (p.canSee(hitObj)) {
							server.send(p.id, "8", [utils.fixTo(this.dir, 2), hitObj.sid]);
						}
					} else {
						server.send(p.id, "12", [hitObj.sid]);
					}
				}

				if (!hitObj.active && hitObj.owner === p) {
					p.changeItemCount(hitObj.group.id, -1);
				}
			}
		}

		this.active = false;

		for (let i = 0; i < players.length; ++i) {
			if (this.sentTo[players[i].id]) {
				server.send(players[i].id, "19", [this.sid, utils.fixTo(shortestDist, 1)]);
			}
		}
	};
};