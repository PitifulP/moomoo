module.exports = function (name, findPlayerBySid, server) {
	this.name = name;
	this.members = [];
	this.ownerId = null;
	this.joinQueue = [];

	this.addPlayer = (player) => {
		player.team = this.name;

		if (this.ownerId === null) {
			this.ownerId = player.sid;
			player.isLeader = true;
		}

		this.members.push(player.sid);
		const memberData = this.getMembers();

		for (let i = 0; i < this.members.length; i++) {
			const p = findPlayerBySid(this.members[i]);
			if (p) {
				server.send(p.id, "sa", [memberData]);
			}
		}
	};

	this.removePlayer = (player) => {
		player.team = null;
		player.isLeader = false;

		const index = this.members.indexOf(player.sid);
		if (index !== -1) {
			this.members.splice(index, 1);
		}

		const memberData = this.getMembers();

		for (let i = 0; i < this.members.length; i++) {
			const p = findPlayerBySid(this.members[i]);
			if (p) {
				server.send(p.id, "sa", [memberData]);
			}
		}
	};

	this.getData = () => {
		return {
			sid: this.name,
			ownerId: this.ownerId
		};
	};

	this.getMembers = () => {
		const result = [];

		for (let i = 0; i < this.members.length; i++) {
			const player = findPlayerBySid(this.members[i]);
			if (player) {
				result.push(player.sid, player.name);
			}
		}

		return result;
	};
};