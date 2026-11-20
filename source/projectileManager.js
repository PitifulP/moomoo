module.exports = function (projectile, projectiles, players, ais, objectManager, items, config, utils, server) {
	this.addProjectile = function (x, y, dir, range, speed, index, owner, ignoreObj, layer) {
		const data = items.projectiles[index];
		let proj = null;

		for (let i = 0; i < projectiles.length; ++i) {
			if (!projectiles[i].active) {
				proj = projectiles[i];
				break;
			}
		}

		if (!proj) {
			proj = new projectile(players, ais, objectManager, items, config, utils, server);
			proj.sid = projectiles.length;
			projectiles.push(proj);
		}

		proj.init(index, x, y, dir, speed, data.dmg, range, data.scale, owner);
		proj.ignoreObj = ignoreObj;
		proj.layer = layer || data.layer;
		proj.src = data.src;

		return proj;
	};
};