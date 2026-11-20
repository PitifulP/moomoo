const mathAbs = Math.abs;
const mathCos = Math.cos;
const mathSin = Math.sin;
const mathPow = Math.pow;
const mathSqrt = Math.sqrt;
const mathAtan2 = Math.atan2;
const mathPi = Math.PI;

module.exports.randInt = function (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports.randFloat = function (min, max) {
	return Math.random() * (max - min + 1) + min;
};

module.exports.random = function (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports.lerp = function (value1, value2, amount) {
	return value1 + (value2 - value1) * amount;
};

module.exports.decel = function (val, cel) {
	if (val > 0) {
		val = Math.max(0, val - cel);
	} else if (val < 0) {
		val = Math.min(0, val + cel);
	}
	return val;
};

module.exports.getDistance = function (x1, y1, x2, y2) {
	return mathSqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
};

module.exports.getDirection = function (x1, y1, x2, y2) {
	return mathAtan2(y1 - y2, x1 - x2);
};

module.exports.getAngleDist = function (a, b) {
	const p = mathAbs(b - a) % (mathPi * 2);
	return p > mathPi ? mathPi * 2 - p : p;
};

module.exports.isNumber = function (n) {
	return typeof n === "number" && !isNaN(n) && isFinite(n);
};

module.exports.isNumber2 = function (potNum, isAbsoluteNumber, returnNumber) {
	if (!isAbsoluteNumber) {
		potNum = parseFloat(potNum);
	}
	if (returnNumber) {
		return potNum;
	}
	return typeof potNum === "number" && !isNaN(potNum) && isFinite(potNum);
};

module.exports.isString = function (s) {
	return s && typeof s === "string";
};

module.exports.animateString = function (str) {
	const arr = str.split("");
	const mapped = arr.map(letter => Math.random() > 0.7 ? "~" : letter);
	return mapped.join("");
};

module.exports.kFormat = function (num) {
	return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
};

module.exports.toRad = function (deg) {
	return deg * (Math.PI / 180);
};

module.exports.toDeg = function (rad) {
	return rad * (180 / Math.PI);
};

module.exports.capitalizeFirst = function (string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
};

module.exports.fixTo = function (n, v) {
	if (!module.exports.isNumber(n)) {
		n = parseFloat(n);
		if (isNaN(n)) return NaN;
	}
	return parseFloat(n.toFixed(v));
};

module.exports.sortByPoints = function (a, b) {
	return parseFloat(b.points) - parseFloat(a.points);
};

module.exports.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
	let minX = x1;
	let maxX = x2;

	if (x1 > x2) {
		minX = x2;
		maxX = x1;
	}

	if (maxX > recX2) maxX = recX2;
	if (minX < recX) minX = recX;
	if (minX > maxX) return false;

	let minY = y1;
	let maxY = y2;
	const dx = x2 - x1;

	if (Math.abs(dx) > 0.0000001) {
		const a = (y2 - y1) / dx;
		const b = y1 - a * x1;
		minY = a * minX + b;
		maxY = a * maxX + b;
	}

	if (minY > maxY) {
		const tmp = maxY;
		maxY = minY;
		minY = tmp;
	}

	if (maxY > recY2) maxY = recY2;
	if (minY < recY) minY = recY;

	return minY <= maxY;
};

module.exports.randomString = function (length) {
	let text = "";
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < length; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
};

module.exports.countInArray = function (array, val) {
	let count = 0;
	for (let i = 0; i < array.length; i++) {
		if (array[i] === val) count++;
	}
	return count;
};

module.exports.randTeam = function (array, teamSize) {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	const teams = [];
	while (shuffled.length > 0) {
		const team = [];
		for (let i = 0; i < teamSize; i++) {
			if (shuffled.length === 0) break;
			team.push(shuffled.pop());
		}
		teams.push(team);
	}
	return teams;
};

const packetCode = {
	send: {
		aJoinReq: "P",
		kickFromClan: "Q",
		sendJoin: "b",
		createAlliance: "L",
		leaveAlliance: "N",
		storeEquipOrBuy: "c",
		sendChat: "6",
		resetMoveDir: "e",
		sendAtckState: "d",
		sendMoveDir: "a",
		sendLockDirOrAutoGather: "K",
		sendMapPing: "S",
		selectToBuild: "G",
		enterGame: "M",
		sendUpgrade: "H",
		sendDir: "D",
		pingSocket: "0"
	},
	receive: {
		ioInit: "io-init",
		setInitData: "A",
		disconnect: "B",
		setupGame: "C",
		addPlayer: "D",
		removePlayer: "E",
		updatePlayers: "a",
		updateLeaderboard: "G",
		loadGameObject: "H",
		loadAI: "I",
		animateAI: "J",
		gatherAnimation: "K",
		wiggleGameObject: "L",
		shootTurret: "M",
		updatePlayerValue: "N",
		updateHealth: "O",
		killPlayer: "P",
		killObject: "Q",
		killObjects: "R",
		updateItemCounts: "S",
		updateAge: "T",
		updateUpgrades: "U",
		updateItems: "V",
		addProjectile: "X",
		remProjectile: "Y",
		serverShutdownNotice: "Z",
		addAlliance: "g",
		deleteAlliance: "1",
		allianceNotification: "2",
		setPlayerTeam: "3",
		setAlliancePlayers: "4",
		updateStoreItems: "5",
		receiveChat: "6",
		updateMinimap: "7",
		showText: "8",
		pingMap: "9",
		pingSocketResponse: "10"
	}
};

const oldPacketCode = {
	send: {
		11: packetCode.send.aJoinReq,
		12: packetCode.send.kickFromClan,
		10: packetCode.send.sendJoin,
		8: packetCode.send.createAlliance,
		9: packetCode.send.leaveAlliance,
		"13c": packetCode.send.storeEquipOrBuy,
		ch: packetCode.send.sendChat,
		rmd: packetCode.send.resetMoveDir,
		c: packetCode.send.sendAtckState,
		33: packetCode.send.sendMoveDir,
		7: packetCode.send.sendLockDirOrAutoGather,
		14: packetCode.send.sendMapPing,
		5: packetCode.send.selectToBuild,
		sp: packetCode.send.enterGame,
		6: packetCode.send.sendUpgrade,
		2: packetCode.send.sendDir,
		pp: packetCode.send.pingSocket
	},
	receive: {
		"io-init": packetCode.receive.ioInit,
		id: packetCode.receive.setInitData,
		d: packetCode.receive.disconnect,
		1: packetCode.receive.setupGame,
		2: packetCode.receive.addPlayer,
		4: packetCode.receive.removePlayer,
		33: packetCode.receive.updatePlayers,
		5: packetCode.receive.updateLeaderboard,
		6: packetCode.receive.loadGameObject,
		a: packetCode.receive.loadAI,
		aa: packetCode.receive.animateAI,
		7: packetCode.receive.gatherAnimation,
		8: packetCode.receive.wiggleGameObject,
		sp: packetCode.receive.shootTurret,
		9: packetCode.receive.updatePlayerValue,
		h: packetCode.receive.updateHealth,
		11: packetCode.receive.killPlayer,
		12: packetCode.receive.killObject,
		13: packetCode.receive.killObjects,
		14: packetCode.receive.updateItemCounts,
		15: packetCode.receive.updateAge,
		16: packetCode.receive.updateUpgrades,
		17: packetCode.receive.updateItems,
		18: packetCode.receive.addProjectile,
		19: packetCode.receive.remProjectile,
		20: packetCode.receive.serverShutdownNotice,
		ac: packetCode.receive.addAlliance,
		ad: packetCode.receive.deleteAlliance,
		an: packetCode.receive.allianceNotification,
		st: packetCode.receive.setPlayerTeam,
		sa: packetCode.receive.setAlliancePlayers,
		us: packetCode.receive.updateStoreItems,
		ch: packetCode.receive.receiveChat,
		mm: packetCode.receive.updateMinimap,
		t: packetCode.receive.showText,
		p: packetCode.receive.pingMap,
		pp: packetCode.receive.pingSocketResponse
	}
};

const newPacketCode = {
	send: {},
	receive: {}
};

for (const key in oldPacketCode.send) {
	newPacketCode.send[oldPacketCode.send[key]] = key;
}

for (const key in oldPacketCode.receive) {
	newPacketCode.receive[oldPacketCode.receive[key]] = key;
}

module.exports.oldToNew = function (packetCode, type) {
	return packetCode;
};

module.exports.newToOld = function (packetCode, type) {
	return packetCode;
};