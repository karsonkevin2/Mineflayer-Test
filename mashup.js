//Defaults to pass by reference for objects!

if (process.argv.length < 4 || process.argv.length > 6) {
    console.log('Usage : node guard.js <host> <port> [<name>] [<password>]')
    //console.log(node guard.js 'localhost' ##### someName)
    process.exit(1)
}

const mineflayer = require('mineflayer')
const autoeat = require('mineflayer-auto-eat')
const armorManager = require('mineflayer-armor-manager')
const pvp = require('mineflayer-pvp').plugin
const {pathfinder, goals, Movements} = require('mineflayer-pathfinder')
const toolPlugin = require('mineflayer-tool').plugin
const registry = require('prismarine-registry')('1.18.1')

const bot = mineflayer.createBot({
    host: process.argv[2],
    port: parseInt(process.argv[3]),
    username: process.argv[4] ? process.argv[4] : 'Guard',
    password: process.argv[5]
})

bot.loadPlugin(autoeat)
bot.loadPlugin(armorManager)
bot.loadPlugin(pvp)
bot.loadPlugin(pathfinder)
bot.loadPlugin(toolPlugin)

var myTime
var guardPos
var mcData
var myMovements

bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version)
    myMovements = new Movements(bot, mcData)
    myMovements.canDig = false
    bot.pathfinder.setMovements(myMovements)

    bot.autoEat.options = {
        priority: 'foodPoints',
        //TODO
        startat: 17,
        bannedFood: ["rotten_flesh"]
    }

    myTime = bot.time.time
})

bot.on('autoeat_started', () => {
    console.log("Autoeat started")
    bot.chat("Eating")
})

bot.on('autoeat_stopped', () => {
    console.log("Autoeat stopped")
})

bot.on('health', () => {
    console.log("I have " +  bot.health + " hp & " + bot.food + " food")

    if(bot.health <= 5 && (bot.time.time - myTime)/20 > 10) {
        myTime = bot.time.time
        bot.chat("I am about to die!")
    }

    if (bot.food >= 20) {
        bot.autoEat.disable()
        equipSword()
    } else {
        bot.autoEat.enable()
    }
})

bot.on('kicked', (reason) => {
    console.log("I got kicked for: " + reason)
})

bot.on('playerCollect', (collector, collected) => {
    if (collector !== bot.entity) {return}

    bot.armorManager.equipAll()

    equipSword()

    //console.log(bot)
    //console.log(registry.blocksByName['stone'])
    //console.log(registry.materials)
})

bot.on('physicTick', () => {
    const filter = e => e.type === 'mob' && 
        e.position.distanceTo(bot.entity.position) < 16 &&
        e.mobType !== 'Armor Stand'

    const entity = bot.nearestEntity(filter)

    if (entity) {
        bot.pvp.attack(entity)
    }
})

bot.on('chat', (username, message) => {
    if (username === bot.username) {return}

    const player = bot.players[username]

    if (message !== "guard") {
        stopGuarding()
    }

    if (message === 'guard') {
        bot.pathfinder.stop()
        if (!player.entity) {
            bot.chat("I can't see you")
        } else {
            bot.chat("Guarding your location")
            bot.pathfinder.setMovements(myMovements)
            guardArea(player.entity.position.clone())
        }

    } else if (message === "stop") {
        bot.chat("Cancelling actions") 
        bot.pathfinder.stop()

    } else if (message === "echo") {
        bot.chat("echo") 

    } else if (message === "come") {
        bot.pathfinder.stop()
        if (!player.entity) {
            bot.chat("I can't see you")
        } else {
            bot.chat("coming to you")
            bot.pathfinder.setMovements(myMovements)
            bot.pathfinder.setGoal(new goals.GoalBlock(player.entity.position.x, player.entity.position.y, player.entity.position.z))
        }

    } else if (message === "sleep") {
        bot.pathfinder.stop()
        goToSleep()

    } else if (message === "wake") {
        wakeUp()

    } else if (message === "follow") {
        bot.pathfinder.stop()
        //dynamic goal == stays active once reached
        bot.chat("Following you")
        bot.pathfinder.setMovements(myMovements)
        bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true)
    }

    else if (message.split(" ")[0] == "goto") {
        bot.pathfinder.stop()
        if (isNaN(Number(message.split(" ")[1])) || isNaN(Number(message.split(" ")[2]))) {
            bot.chat("Invalid coordinates")
        } else if (message.split(" ").length == 3) {
            bot.pathfinder.setMovements(myMovements)
            bot.pathfinder.setGoal(new goals.GoalXZ(Number(message.split(" ")[1]), Number(message.split(" ")[2])))
        } else if (message.split(" ").length == 4) {
            if (isNaN(Number(message.split(" ")[3]))) {
                bot.chat("Invalid coordinates")
            } else {
                bot.pathfinder.setMovements(myMovements)
                bot.pathfinder.setGoal(new goals.GoalBlock(Number(message.split(" ")[1]), Number(message.split(" ")[2]), Number(message.split(" ")[3])))
            }
        } else {
            bot.chat("Need 2 or 3 arguments")
        }
    }
})

function guardArea(pos) {
    guardPos = pos
    if (!bot.pvp.target) {
        moveToGuardPos()
    }
}

function stopGuarding() {
    guardPos = null
    //bot.pvp.stop()
    //bot.pathfinder.setGoal(null)
}

//Move to position
function moveToGuardPos() {
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
}

bot.on('stoppedAttacking', () => {
    if (guardPos) {
        moveToGuardPos()
    }
})

async function goToSleep () {
    const bed = bot.findBlock({
        matching: block => bot.isABed(block)
    })
    console.log(bed)
    if (bed) {
        bot.chat("Walking to the bed")
        await bot.pathfinder.goto(new goals.GoalNear(bed.position.x, bed.position.y, bed.position.z, 1))
            console.log("test")
            try {
                await bot.sleep(bed)
                bot.chat("I'm sleeping")
            } catch (err) {
                bot.chat("I can't sleep because: " + err.message)
            }
        
    } else {
        bot.chat("No nearby beds")
    }
}

async function wakeUp() {
    try {
        await bot.wake()
        bot.chat("I am up")
    } catch (err) {
        bot.chat("I can't wake up because: " + err.message)
    }
}

function equipSword() {
    sword = bot.inventory.items().find(item => item.name.includes('sword'))
	if (sword) {bot.equip(sword, 'hand')}
}