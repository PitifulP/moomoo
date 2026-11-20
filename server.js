const WebSocket = require('ws');
const msgpack = require('@msgpack/msgpack');
const http = require('http');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const config = require('./source/config');
const utils = require('./source/utils');
const items = require('./source/items');
const store = require('./source/store');
const Player = require('./source/player');
const GameObject = require('./source/gameObject');
const ObjectManager = require('./source/objectManager');
const Projectile = require('./source/projectile');
const ProjectileManager = require('./source/projectileManager');
const Ai = require('./source/ai');
const AiManager = require('./source/aiManager');
const Tribe = require('./source/tribe');
const TribeManager = require('./source/tribeManager');
const WorldGen = require('./source/worldGen');

const PORT = parseInt(process.env.PORT) || 3000;
const MODE = (process.env.MODE || 'normal').toLowerCase();

const S = { reset: '\x1b[0m', dim: '\x1b[2m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m' };
const log = {
    info: (...a) => console.log(`${S.cyan}›${S.reset}`, ...a),
    ok: (...a) => console.log(`${S.green}✓${S.reset}`, ...a),
    err: (...a) => console.log(`${S.red}✗${S.reset}`, ...a),
};

process.on('uncaughtException', err => { log.err(`uncaught: ${err.message}`); process.exit(1); });
process.on('unhandledRejection', reason => { log.err(`unhandled: ${reason}`); });

const mode = ['normal', 'sandbox'].includes(MODE) ? MODE : 'normal';

const rnd = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
const SERVER_CODE = rnd() + rnd();
const SERVER_CAPACITY = 40;

const hats = store.hats;
const accs = store.accessories;

let lastUpdate = Date.now();
let ais = [], players = [], gameObjects = [], projectiles = [], playersSid = [];
let connection = {};
let objectManager, aiManager, projectileManager, tribeManager;

const wsServer = new WebSocket.Server({ noServer: true, maxPayload: 4096 });

wsServer.send = function(id, type, data = []) {
    if (connection[id]) {
        connection[id].send(new Uint8Array(Array.from(
            msgpack.encode([utils.oldToNew(type, 'RECEIVE'), data])
        )));
    }
};

wsServer.sendAll = function(type, data = []) {
    for (const p of players) wsServer.send(p.id, type, data);
};

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json());

app.get('/', (req, res, next) => {
    if (!req.query.server) return res.redirect(`/?server=Local:${SERVER_CODE}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/ping', (_req, res) => res.send('ok'));
app.get('/servers', (_req, res) => res.json([{ region: 'Local', name: SERVER_CODE, playerCount: players.length, playerCapacity: SERVER_CAPACITY }]));

const httpServer = http.createServer(app);

function findPlayerById(id) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].id === id) return players[i];
    }
    return null;
}

function findPlayerBySid(sid) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].sid === sid) return players[i];
    }
    return null;
}

function updateLeaderboard() {
    const sorted = players.filter(p => p.alive && !p.spectator).sort(utils.sortByPoints).slice(0, 10);
    const data = [];
    for (const p of sorted) data.push(p.sid, p.name, p.points);
    wsServer.sendAll('5', [data]);
}

function scoreCallback(player, amount) {
    player.points += amount;
    player.earnXp(amount);
    wsServer.send(player.id, '9', ['points', Math.round(player.points), 1]);
}

function iconCallback() {
    let highestKill = 0, highest = null;
    for (let i = 0; i < players.length; i++) {
        players[i].iconIndex = 0;
        if (players[i].alive && players[i].kills > 0 && (highest == null || highestKill < players[i].kills)) {
            highest = i;
            highestKill = players[i].kills;
        }
    }
    if (highest !== null) players[highest].iconIndex = 1;
}

function setupServer() {
    config.isStarted = false;
    wsServer.clients.forEach(s => { if (s.readyState === WebSocket.OPEN) s.close(); });
    ais.splice(0); players.splice(0); gameObjects.splice(0);
    projectiles.splice(0); playersSid.splice(0);
    connection = {};

    objectManager = new ObjectManager(GameObject, gameObjects, utils, config, players, wsServer);
    aiManager = new AiManager(ais, Ai, players, items, objectManager, config, utils, scoreCallback, wsServer);
    projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, utils, wsServer);
    tribeManager = new TribeManager(Tribe, findPlayerBySid, wsServer);

    config.inSandbox = mode === 'sandbox';
    config.canHitObj = true;

    new WorldGen({ objectManager, aiManager, config, utils, gameObjects }).populate();
    log.ok(`server ready (mode: ${mode})`);
}

wsServer.on('connection', function(conn) {
    do { conn.id = utils.randomString(10); } while (players.some(p => p.id === conn.id));
    conn.sid = 1;
    while (playersSid.includes(conn.sid)) conn.sid++;
    playersSid.push(conn.sid);
    connection[conn.id] = conn;

    conn.on('error', err => console.log(`socket error: ${err.message}`));

    conn.on('close', function() {
        const p = findPlayerById(conn.id);
        if (p) {
            if (p.team) {
                if (p.isLeader) {
                    wsServer.sendAll('ad', [p.team]);
                    tribeManager.deleteTribe(p.team);
                } else {
                    tribeManager.getTribe(p.team)?.removePlayer(p);
                }
            }
            wsServer.sendAll('4', [conn.id]);
            objectManager.removeAllItems(p.sid, wsServer);
            for (let i = 0; i < players.length; i++) {
                if (players[i].id === conn.id) {
                    players.splice(i, 1);
                    const idx = playersSid.indexOf(conn.sid);
                    if (idx !== -1) playersSid.splice(idx, 1);
                    updateLeaderboard();
                    iconCallback();
                    break;
                }
            }
        }
        delete connection[conn.id];
    });

    const newPlayer = new Player(
        conn.id, conn.sid, config, utils,
        projectileManager, objectManager, players, ais,
        items, hats, accs, wsServer,
        scoreCallback, iconCallback, mode
    );
    newPlayer.visible = false;
    players.push(newPlayer);

    wsServer.send(conn.id, 'io-init', [conn.id]);
    wsServer.send(conn.id, 'id', [{ teams: Object.values(tribeManager.tribes).map(t => t.getData()) }]);

    conn.on('message', function(message) {
        if (conn.isTerminated) return;
        let data, type;
        try {
            const parsed = msgpack.decode(new Uint8Array(message));
            if (!Array.isArray(parsed)) return;
            type = utils.newToOld(parsed[0], 'SEND');
            data = parsed[1] || [];
        } catch { return; }
        if (conn.isTerminated) return;

        const events = {
            p: pingSocket,
            j: enterGame,
            m: sendMoveDir,
            s: resetMoveDir,
            d: sendDir,
            a: sendAttackState,
            b: selectToBuild,
            u: (index) => sendUpgrade(index, false),
            g: sendLockGather,
            c: sendMessage,
            f: storeFunction,
            y: createAlliance,
            l: leaveAlliance,
            r: sendJoinRequest,
            w: decideJoinRequest,
            k: kickFromClan,
            n: sendMapPing,
        };

        if (events[type]) {
            try {
                events[type].apply(undefined, Array.isArray(data) ? data : [data]);
            } catch (err) {
                console.log(`event "${type}" error: ${err.message}`);
            }
        }

        function pingSocket() {
            const p = findPlayerById(conn.id);
            if (!p) return;
            wsServer.send(conn.id, 'pp');
        }

        function enterGame(data) {
            if (!data || !data.moofoll || typeof data.name !== 'string') return;
            const p = findPlayerById(conn.id);
            if (!p || p.alive) return;

            const nameRe = /^[a-zA-Z0-9\-?_():/ ]*$/;
            let name = (data.name.slice(0, 15).trim().match(nameRe)?.[0]) ?? '';
            name = name.trim() || 'unknown';

            p.name = name;
            p.spawn(data.moofoll);
            p.visible = false;

            const location = objectManager.fetchSpawnObj(p.sid)
                || [utils.randInt(0, config.mapScale), utils.randInt(0, config.mapScale)];
            p.setData([p.id, p.sid, name, location[0], location[1], 0, 100, 100, config.playerScale, data.skin]);
            wsServer.send(conn.id, '1', [p.sid]);
            updateLeaderboard();
        }

        function resetMoveDir() {
            const p = findPlayerById(conn.id);
            if (!p || !p.alive || p.spectator) return;
            p.resetMoveDir();
        }

        function sendMoveDir(newMoveDir) {
            const p = findPlayerById(conn.id);
            if (!p || !p.alive || p.spectator) return;
            if (newMoveDir !== null && (typeof newMoveDir !== 'number' || !isFinite(newMoveDir) || Math.abs(newMoveDir) > Math.PI * 2)) return;
            p.moveDir = newMoveDir;
        }

        function sendDir(newDir) {
            const p = findPlayerById(conn.id);
            if (!p || !p.alive || p.spectator) return;
            if (typeof newDir !== 'number' || !isFinite(newDir) || Math.abs(newDir) > Math.PI * 2) return;
            p.dir = Number(newDir.toFixed(7));
        }

        function sendAttackState(mouseState, dir) {
            const p = findPlayerById(conn.id);
            if (!p || p.spectator) return;
            if (typeof mouseState !== 'number' || (mouseState !== 0 && mouseState !== 1)) return;
            if (dir !== undefined && dir !== null && (typeof dir !== 'number' || !isFinite(dir))) return;
            if (p.alive) {
                if (dir) p.dir = dir;
                p.mouseState = mouseState;
                if (mouseState) {
                    if (p.buildIndex >= 0) {
                        for (let i = 0; i < items.list.length; i++) {
                            if (i === p.buildIndex) { p.buildItem(items.list[i]); break; }
                        }
                    } else {
                        p.gathering = mouseState;
                    }
                }
            }
        }

        function selectToBuild(index, wpn) {
            const p = findPlayerById(conn.id);
            if (!p || !p.alive || p.spectator) return;
            if (typeof index !== 'number') return;
            if (wpn) {
                p.buildIndex = -1;
                if (p.weapons?.includes(index)) p.weaponIndex = index;
            } else {
                const hasItem = p.items?.includes(index);
                const canBuild = hasItem && items?.list?.[index] && p.canBuild(items.list[index]);
                p.buildIndex = (!canBuild || p.buildIndex === index) ? -1 : index;
            }
        }

        function sendLockGather(type) {
            const p = findPlayerById(conn.id);
            if (!p || !p.alive || p.spectator) return;
            if (typeof type !== 'number' || (type !== 0 && type !== 1)) return;
            if (type === 0) p.lockDir = p.lockDir ? 0 : 1;
            if (type === 1) p.autoGather = p.autoGather ? 0 : 1;
        }

        function sendMessage(message) {
            if (typeof message !== 'string') return;
            message = message.replace(/[\r\n]/g, ' ');
            if (message.length <= 0 || message.length > 30) return;
            const p = findPlayerById(conn.id);
            if (!p || !p.alive) return;
            const allowed = /[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻáéíñóúüÁÉÍÑÓÚÜàèìòùÀÈÌÒÙäöüßÄÖÜЀ-ӿԀ-ԯ,./';[\]=\-<>?":}{+_)(*&^%$#@!`~ ]/g;
            const filtered = message.match(allowed)?.join('') || '';
            if (!filtered.length) return;
            wsServer.sendAll('ch', [p.sid, filtered]);
        }

        function storeFunction(type, id, index) {
            if (typeof id !== 'number') return;
            const p = findPlayerById(conn.id);
            if (!p || p.spectator || !p.alive) return;
            if (id === 0) {
                if (!type) {
                    if (index) { p.tailIndex = 0; p.tail = null; }
                    else { p.skinIndex = 0; p.skin = null; }
                    wsServer.send(conn.id, 'us', [1, 0, index]);
                }
                return;
            }
            const list = index ? accs : hats;
            const tmpObj = list.find(x => x.id === id);
            if (!tmpObj) return;
            if (index) {
                if (type) {
                    if (tmpObj.price <= p.points) {
                        p.addResource(3, -tmpObj.price);
                        p.tails[id] = 1;
                        wsServer.send(conn.id, 'us', [0, id, index]);
                    }
                } else {
                    if (p.tails[id]) { p.tail = tmpObj; p.tailIndex = id; wsServer.send(conn.id, 'us', [1, id, index]); }
                }
            } else {
                if (type) {
                    if (tmpObj.price <= p.points) {
                        p.addResource(3, -tmpObj.price);
                        p.skins[id] = 1;
                        wsServer.send(conn.id, 'us', [0, id, index]);
                    }
                } else {
                    if (p.skins[id]) { p.skin = tmpObj; p.skinIndex = id; wsServer.send(conn.id, 'us', [1, id, index]); }
                }
            }
        }

        function sendUpgrade(index, isForced = false) {
            if (index < 0 || index > items.weapons.length + items.list.length) return;
            const p = findPlayerById(conn.id);
            if (!p || (!p.alive && !p.spectator)) return;
            if (!isForced && p.upgradePoints <= 0) return;

            const upgrWeapons = isForced ? items.weapons : items.weapons.filter(x => x.age === p.upgrAge);
            const upgrItems = isForced ? items.list : items.list.filter(x => x.age === p.upgrAge);

            if (index < items.weapons.length) {
                const wpn = upgrWeapons.find(x => x.id === index);
                if (!wpn) return;
                p.weapons[wpn.type] = wpn.id;
                p.weaponXp[wpn.type] = 0;
                const slotType = p.weaponIndex < 9 ? 0 : 1;
                if (wpn.type === slotType) p.weaponIndex = wpn.id;
                wsServer.send(conn.id, '17', [p.weapons, 1]);
            } else {
                const itemIndex = index - items.weapons.length;
                if (!upgrItems.some(x => x.id === itemIndex)) return;
                p.addItem(itemIndex);
                wsServer.send(conn.id, '17', [p.items]);
            }

            if (!isForced) {
                p.upgrAge++; p.upgradePoints--;
                wsServer.send(conn.id, '16', [p.upgradePoints, p.upgrAge]);
            }
        }

        function createAlliance(name) {
            if (typeof name !== 'string' || name.length <= 0 || name.length > 7) return;
            const filtered = (name.match(/[a-zA-Z0-9,./';[\]=\-<>?":}{+_)(*&^%$#@!`~ ]/g) || []).join('');
            if (!filtered.length) return;
            const p = findPlayerById(conn.id);
            if (!p || p.spectator) return;
            if (p.alive && !p.team && !p.isLeader) {
                if (tribeManager.getTribe(filtered) == null) {
                    const clan = tribeManager.createTribe(filtered, p);
                    wsServer.sendAll('ac', [clan.getData()]);
                    wsServer.send(conn.id, 'st', [filtered, 1]);
                }
            }
        }

        function leaveAlliance() {
            const p = findPlayerById(conn.id);
            if (!p || p.spectator || !p.alive || !p.team) return;
            if (p.isLeader) {
                wsServer.sendAll('ad', [p.team]);
                tribeManager.deleteTribe(p.team);
            } else {
                tribeManager.getTribe(p.team)?.removePlayer(p);
                wsServer.send(conn.id, 'st', [null, 0]);
            }
        }

        function kickFromClan(sid) {
            const p = findPlayerById(conn.id);
            if (!p?.alive || !p.isLeader) return;
            const target = findPlayerBySid(sid);
            if (!target) return;
            tribeManager.getTribe(p.team)?.removePlayer(target);
            wsServer.send(target.id, 'st', [null, 0]);
        }

        function sendJoinRequest(sid) {
            const p = findPlayerById(conn.id);
            if (!p?.alive) return;
            const clan = tribeManager.getTribe(sid);
            if (!clan || clan.joinQueue.some(q => q[1] === conn.id)) return;
            const owner = findPlayerBySid(clan.ownerId);
            if (!owner) return;
            clan.joinQueue.push([p.sid, p.id]);
            wsServer.send(owner.id, 'an', [p.sid, p.name]);
        }

        function decideJoinRequest(sid, join) {
            const p = findPlayerById(conn.id);
            if (!p?.alive || !p.isLeader) return;
            const target = findPlayerBySid(sid);
            const clan = tribeManager.getTribe(p.team);
            if (!clan || !target) return;
            const queued = clan.joinQueue.shift();
            if (!queued || queued[1] !== target.id) return;
            if (join && target.team == null) {
                clan.addPlayer(target);
                wsServer.send(target.id, 'st', [p.team, 0]);
            }
        }

        function sendMapPing(type) {
            if (!type) return;
            const p = findPlayerById(conn.id);
            if (!p?.alive) return;
            if (p.team) {
                for (const player of players) {
                    if (player.team === p.team) wsServer.send(player.id, 'p', [p.x, p.y]);
                }
            } else {
                wsServer.send(conn.id, 'p', [p.x, p.y]);
            }
        }
    });
});

httpServer.on('upgrade', (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, ws => wsServer.emit('connection', ws, req));
});

function startLoop() {
    const WARMUP_MS = 10_000;
    const bootTime = Date.now();

    setInterval(() => {
        const now = Date.now();
        const delta = now - lastUpdate;
        lastUpdate = now;

        const tps = 1000 / delta;
        if (tps < 8 && (now - bootTime) > WARMUP_MS) {
            console.log(`low tickrate: ${tps.toFixed(2)} tps (delta: ${delta}ms)`);
        }

        for (let i = 0; i < players.length; i++) {
            if (players[i]) players[i].update(delta);
        }
        for (let i = 0; i < ais.length; i++) {
            if (ais[i]) ais[i].update(delta);
        }

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p || !p.alive) continue;
            if (p.shootCount > 0) { p.shootCount -= delta; continue; }
            if (!p.skin || !p.skin.turret) continue;
            let target = null, bestDst = Infinity;
            for (let j = 0; j < players.length; j++) {
                const t = players[j];
                if (!t.alive || t.spectator || t.sid === p.sid) continue;
                if (t.skin && t.skin.antiTurret) continue;
                if (p.team && p.team === t.team) continue;
                const d = utils.getDistance(p.x, p.y, t.x, t.y);
                if (d <= p.skin.turret.range && d < bestDst) { bestDst = d; target = t; }
            }
            for (let k = 0; k < ais.length; k++) {
                const a = ais[k];
                if (!a.alive || !a.hostile) continue;
                const d = utils.getDistance(p.x, p.y, a.x, a.y);
                if (d <= p.skin.turret.range && d < bestDst) { bestDst = d; target = a; }
            }
            if (target) {
                p.shootCount = p.skin.turret.rate;
                projectileManager.addProjectile(p.x, p.y, utils.getDirection(target.x, target.y, p.x, p.y), p.skin.turret.range, 1.5, p.skin.turret.proj, p);
            }
        }

        for (let i = 0; i < objectManager.updateObjects.length; i++) {
            const obj = objectManager.updateObjects[i];
            if (obj.shootCount > 0) { obj.shootCount -= delta; continue; }
            if (!obj.active || !obj.shootRange) continue;
            let target = null, bestDst = Infinity;
            for (let j = 0; j < players.length; j++) {
                const p = players[j];
                if (!p.alive || p.spectator) continue;
                if (p.skin && p.skin.antiTurret) continue;
                if (p.sid === obj.owner.sid) continue;
                if (obj.owner.team && obj.owner.team === p.team) continue;
                const d = utils.getDistance(obj.x, obj.y, p.x, p.y);
                if (d <= obj.shootRange && d < bestDst) { bestDst = d; target = p; }
            }
            for (let k = 0; k < ais.length; k++) {
                const a = ais[k];
                if (!a.active || !a.hostile) continue;
                const d = utils.getDistance(obj.x, obj.y, a.x, a.y);
                if (d <= obj.shootRange && d < bestDst) { bestDst = d; target = a; }
            }
            if (target) {
                obj.dir = utils.getDirection(target.x, target.y, obj.x, obj.y);
                obj.shootCount = obj.shootRate;
                projectileManager.addProjectile(obj.x, obj.y, obj.dir, obj.shootRange, 1.5, obj.projectile, obj.owner, obj.sid);
                wsServer.sendAll('sp', [obj.sid, obj.dir]);
            }
        }

        for (let i = 0; i < projectiles.length; i++) projectiles[i].update(delta);

        for (let j = 0; j < players.length; j++) {
            const viewer = players[j];
            if (!viewer) continue;
            const playersData = [];
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                if (!p || !viewer.canSee(p)) continue;
                if (p.spectator && p.id !== viewer.id) continue;
                if (!p.sentTo[viewer.id]) {
                    p.sentTo[viewer.id] = 1;
                    wsServer.send(viewer.id, '2', [
                        [p.id, p.sid, p.name, p.x, p.y, p.dir, p.health, p.maxHealth, config.playerScale, p.skinColor],
                        p.id === viewer.id
                    ]);
                }
                if (p.alive) {
                    const status = p.spectator ? 2 : (p.isLeader ? 1 : 0);
                    playersData.push(p.sid, p.x, p.y, p.dir, p.buildIndex, p.weaponIndex, config.fetchVariant(p).id, p.team, status, p.shameTimer > 0 ? 45 : p.skinIndex, p.tailIndex, p.iconIndex, p.zIndex);
                }
            }
            wsServer.send(viewer.id, '33', [playersData]);

            const aiData = [];
            for (let i = 0; i < ais.length; i++) {
                const a = ais[i];
                if (a && a.alive && viewer.canSee(a)) aiData.push(a.sid, a.index, a.x, a.y, a.dir, a.health, a.nameIndex);
            }
            wsServer.send(viewer.id, 'a', [aiData]);

            const objData = [];
            for (let i = 0; i < gameObjects.length; i++) {
                const o = gameObjects[i];
                if (o && o.active && viewer.canSee(o) && o.visibleToPlayer(viewer) && !o.sentTo[viewer.id]) {
                    o.sentTo[viewer.id] = 1;
                    objData.push(o.sid, o.x, o.y, o.dir, o.scale, o.type, o.id, o.owner?.sid);
                }
            }
            wsServer.send(viewer.id, '6', [objData]);
        }
    }, 1000 / config.serverUpdateRate);

    setInterval(() => {
        for (let i = 0; i < players.length; i++) {
            if (players[i].pps) scoreCallback(players[i], players[i].pps);
        }
        updateLeaderboard();
    }, 1111);

    setInterval(() => {
        for (const key in tribeManager.tribes) {
            const tribe = tribeManager.tribes[key];
            if (!tribe || !Array.isArray(tribe.members) || tribe.members.length === 0) continue;
            const ids = [], pos = [];
            for (let i = 0; i < tribe.members.length; i++) {
                const p = findPlayerBySid(tribe.members[i]);
                if (!p || !p.alive) continue;
                ids.push(p.id);
                pos.push(p.x, p.y);
            }
            for (let i = 0; i < ids.length; i++) {
                wsServer.send(ids[i], 'mm', [pos.filter((_, idx) => idx !== i * 2 && idx !== i * 2 + 1)]);
            }
        }
        for (let i = 0; i < players.length; i++) {
            if (players[i].team == null && players[i].alive) wsServer.send(players[i].id, 'mm', [0]);
        }
    }, 3000);
}

function boot() {
    setupServer();
    startLoop();
    httpServer.listen(PORT, () => {
        console.log(`\n  ${S.cyan}>${S.reset} moomoo.io ${S.dim}v1.7.6${S.reset}`);
        console.log(`  ${S.cyan}>${S.reset} listening on port ${S.dim}${PORT}${S.reset}\n`);
    });
}

boot();
