module.exports = function (tribe, findPlayerBySid, server) {
	this.tribes = {};

	this.createTribe = (name, player) => {
		const newTribe = new tribe(name, findPlayerBySid, server);
		this.tribes[name] = newTribe;
		newTribe.addPlayer(player);
		return newTribe;
	};

	this.deleteTribe = (name) => {
		const tribe = this.tribes[name];
		if (!tribe) return;

		for (let i = 0; i < tribe.members.length; i++) {
			const player = findPlayerBySid(tribe.members[i]);
			if (player) {
				player.team = null;
				player.isLeader = false;
				server.send(player.id, "st", [null, 0]);
			}
		}

		delete this.tribes[name];
	};

	this.getTribe = (name) => {
		return this.tribes[name];
	};
};