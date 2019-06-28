import { debug } from "debug";
import { PreventIframe } from "express-msteams-host";
import { MessagingExtensionQuery, MessagingExtensionResult } from "botbuilder-teams";
import { IMessagingExtensionMiddlewareProcessor } from "botbuilder-teams-messagingextensions";
import { ResultsProvider } from "../resultsProviders/ResultsProvider";

// Initialize debug logging module
const log = debug("msteams");

@PreventIframe("/searchMessageExtension/config.html")
export default class SearchMessageExtension implements IMessagingExtensionMiddlewareProcessor {

    public async onQuery(context: any, query: MessagingExtensionQuery): Promise<any> {

        if (query.parameters && query.parameters[0] && query.parameters[0].name === "initialRun") {
            // Not yet implemented (not sure what the requirements are - default query?)
        } else {
            // Retrieve results
            let req = new ResultsProvider(query.commandId as string);
            let results = await req.getResults(query);
            return results;
        }
    }

    public async onCardButtonClicked(context: any, value: any): Promise<void> {
        // Handle the Action.Submit action on the adaptive card
        if (value.action === "moreDetails") {
            log(`I got this ${value.id}`);
        }
        return Promise.resolve();
    }

    // this is used when canUpdateConfiguration is set to true
    public async onQuerySettingsUrl(context: any): Promise<{ title: string, value: string }> {
        return Promise.resolve({
            title: "lookup Configuration",
            value: `https://${process.env.HOSTNAME}/searchMessageExtension/config.html`
        });
    }

    public async onSettings(context: any): Promise<void> {
        // take care of the setting returned from the dialog, with the value stored in state
        const setting = context.activity.value.state;
        log(`New setting: ${setting}`);
        return Promise.resolve();
    }

}
