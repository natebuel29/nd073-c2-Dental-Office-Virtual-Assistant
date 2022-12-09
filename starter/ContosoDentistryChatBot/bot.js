// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { CustomQuestionAnswering } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor() {
        // call the parent constructor
        super();

        // create a QnAMaker connector
        this.QnAMaker = new CustomQuestionAnswering({
            knowledgeBaseId: process.env.ProjectName,
            endpointKey: process.env.LanguageEndpointKey,
            host: process.env.LanguageEndpointHostName
        });

        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler({
            SchedulerEndpoint: process.env.SchedulerEndpoint
        })

        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer({
            applicationId: process.env.LuisAppId,
            endpointKey: process.env.LuisAPIKey,
            endpoint: process.env.LuisAPIHostName,
        });


        this.onMessage(async (context, next) => {

            const qnaResults = await this.QnAMaker.getAnswers(context);

            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);

            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                LuisResult.intents.GetAvailability.score > .6
            ) {
                const dentistAvailabilityResponse = await this.dentistScheduler.getAvailability();
                await context.sendActivity(dentistAvailabilityResponse);
                await next();
                return;
            }

            else if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .6 &&
                LuisResult.entities.$instance &&
                LuisResult.entities.$instance.time
            ) {
                const time = LuisResult.entities.$instance.time[0].text;
                const scheduleAppointmentResponse = await this.dentistScheduler.scheduleAppointment(time);

                await context.sendActivity(scheduleAppointmentResponse);
                await next();
                return;
            }

            else if (qnaResults[0]) {
                await context.sendActivity(`${qnaResults[0].answer}`);
            }

            else {
                await context.sendActivity("Sorry, I had trouble understanding what you said. Can you please repeat that?");
            }
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            //write a custom greeting
            const welcomeText = `Hi! I am the Contoso Dentistry Virtual Assistant.
                            I am able to assist with booking appointments and can answer questions
                            about our establishment.`;

            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // by calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
