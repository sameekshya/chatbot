'use strict';
var isEmail=require('isemail');

 // --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message
        },
    };
}

function close(sessionAttributes, fulfillmentState, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState,
            message
        },
    };
}

function delegate(sessionAttributes, slots) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Delegate',
            slots
        },
    };
}



// ---------------- Helper Functions --------------------------------------------------

function parseLocalDate(date) {    
    const dateComponents = date.split(/\-/);
    return new Date(dateComponents[0], dateComponents[1] - 1, dateComponents[2]);
}

function diffDate(date) {    
    if((parseLocalDate(date)- new Date())<2419200000) {
		return true;
	}
	else {
		return false;
	}
}


function isValidDate(date) {
    try {
        return !(isNaN(parseLocalDate(date).getTime()));
    } catch (err) {
        return false;
    }
}

function buildValidationResult(isValid, violatedSlot, messageContent) {
    if (messageContent === null) {		
        return {
            isValid,
            violatedSlot
        };
    }
    return {
        isValid,
        violatedSlot,
        message: { contentType: 'PlainText', content: messageContent }
    };
}

function validateOrderCargo(cargoType, transportDate, loadingPort, deportingPort, email) {
    const cargoTypes = ['passenger car', 'heavy vehicles', 'small vehicles'];	
	const ports = ['singapore','shanghai','busan','jebel Ali','rotterdam','port klang','antwerp','hamburg','los angeles','tanjung priok','valencia','piraeus',
	'keihin ports','columbo','jawaharlal nehru','felixstowe','santos','port said east','colon','sharjah','ambarli'];	
    if (cargoType && cargoTypes.indexOf(cargoType.toLowerCase()) === -1) {
        return buildValidationResult(false, 'CargoType', `Apologies currently our company do not have serve ${cargoType} type, would you like register your order under passenger car, heavy vehicles or small vehicles?`);
    } 
	if(loadingPort){
	    if(ports.indexOf(loadingPort.toLowerCase()) === -1){	        
		    return buildValidationResult(false, 'LoadingPort', `Sorry we do not provide services to the ${loadingPort} port. Please select a different loading port.`);
	    }
	}
	if(deportingPort){		
	    if(ports.indexOf(deportingPort.toLowerCase()) === -1){	        
		    return buildValidationResult(false, 'DeportingPort', `Sorry we do not provide services to the ${deportingPort} port. Please select a different deporting port.`);
	    }
		if(loadingPort && loadingPort.toLowerCase() === deportingPort.toLowerCase()){			
			return buildValidationResult(false, 'DeportingPort', 'Sorry loading port and deporting port cannot be same. Please select a different deporting port.');
		}
	}
    if (transportDate) {
        if (!isValidDate(transportDate)) {
            return buildValidationResult(false, 'TransportDate', 'Apologies I did not understand that, could you repeat the date of loading please in YYYY-MM-DD format');
        }
        if (diffDate(transportDate)) {
            return buildValidationResult(false, 'TransportDate', 'Apologies due to company policy the transport date needs to be be atleast after 28 days from the booking registration date');
        }
    }
	if(email && !isEmail.validate(email)){
		return buildValidationResult(false, 'Email', 'Please provide a proper email id e.g. abc@gmail.com so that we can send the price chart and the invoice form');
	}		
    return buildValidationResult(true, null, null);
}

 // --------------- Functions that control the bot's behavior -----------------------

// Performs dialog management and fulfillment for ordering cargo transport.

function cargoRegister(intentRequest, callback) {
    const cargoType = intentRequest.currentIntent.slots.CargoType;	
    const transportDate = intentRequest.currentIntent.slots.TransportDate;
	const loadingPort = intentRequest.currentIntent.slots.LoadingPort;
	const deportingPort = intentRequest.currentIntent.slots.DeportingPort;
	const email = intentRequest.currentIntent.slots.Email;
    const source = intentRequest.invocationSource;

    if (source === 'DialogCodeHook') {
        // Perform basic validation on the supplied input slots.  Use the elicitSlot dialog action to re-prompt for the first violation detected.
        const slots = intentRequest.currentIntent.slots;
        const validationResult = validateOrderCargo(cargoType, transportDate, loadingPort, deportingPort, email);
        if (!validationResult.isValid) {
            slots[`${validationResult.violatedSlot}`] = null;
            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
            return;
        }			
        // Pass the price of the cargo back through session attributes to be used in various prompts defined on the bot model.
        const outputSessionAttributes = intentRequest.sessionAttributes || {};
        if (cargoType) {
			if(cargoType.toLowerCase() === 'passenger car'){
				outputSessionAttributes.Price = 0.65; 
			} else if(cargoType.toLowerCase() === 'heavy vehicles'){
				outputSessionAttributes.Price = 0.90; 
			} else if(cargoType.toLowerCase() === 'small vehicles'){
				outputSessionAttributes.Price = 0.40; 
			}
            
        }		
        callback(delegate(outputSessionAttributes, intentRequest.currentIntent.slots));
        return;
    }

    // Order the cargo, and rely on the goodbye message of the bot to define the message to the end user. 
    callback(close(intentRequest.sessionAttributes, 'Fulfilled',
    { contentType: 'PlainText', content: `Thank you, your order for transport of ${cargoType} on ${transportDate} from ${loadingPort} to ${deportingPort} has been registered. Please allow us 2-3 working days to send you details through email` }));
}

function cargoHelp(intentRequest, callback){
	 var speechOutput = "You have to place order for vehicle shipment for which I will ask you a series of questions to place your order.\n" 
		+"First I will ask about the cargo type (Passenger car,Heavy vehicles or Small vehicles). "+
		"Next I will ask information on Loading port, Destination port (loading and destination and should be from the list).\n"+
		" Next I will ask information Transport date (needs to be atleast 28 days from today in YYYY-MM-DD format e.g. for today "+new Date().toISOString().slice(0,10)+").\n"+
		" At last I need your email Id so that we can send you deatils with invoice form attached (email will be sent to you in 2-3 working days).\n"+
        "Hope the information helps you.";
		const source = intentRequest.invocationSource;		
		const outputSessionAttributes = intentRequest.sessionAttributes || {};
		if (source === 'DialogCodeHook'){
			callback(close(intentRequest.sessionAttributes, 'Fulfilled', { contentType: 'PlainText', content: speechOutput}));
		}
}

 // --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */
function dispatch(intentRequest, callback) {
    console.log(`dispatch userId=${intentRequest.userId}, intentName=${intentRequest.currentIntent.name}`);

    const intentName = intentRequest.currentIntent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'CargoRegister') {
        return cargoRegister(intentRequest, callback);
    } else if (intentName === 'CargoHelp'){
		return cargoHelp(intentRequest, callback);
	}
    throw new Error(`Intent with name ${intentName} not supported`);
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
    try {
        // By default, treat the user request as coming from the America/New_York time zone.
        process.env.TZ = 'America/New_York';
        console.log(`event.bot.name=${event.bot.name}`);
       
        if (event.bot.name !== 'VehicleCargoTransport') {
             callback('Invalid Bot Name');
        } 
        dispatch(event, (response) => callback(null, response));
    } catch (err) {
        callback(err);
    }
};
