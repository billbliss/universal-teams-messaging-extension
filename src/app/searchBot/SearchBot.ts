import { BotDeclaration, MessageExtensionDeclaration, IBot, PreventIframe } from "express-msteams-host";
import * as debug from "debug";
import { DialogSet, DialogState } from "botbuilder-dialogs";
import { StatePropertyAccessor, TurnContext, MemoryStorage, ConversationState, ActivityTypes, Middleware, MiddlewareHandler, BotFrameworkAdapter } from "botbuilder";
import SearchMessageExtension from "../searchMessageExtension/SearchMessageExtension";
import { TeamsActivityProcessor, TeamsAdapter } from "botbuilder-teams";
import { MessagingExtensionMiddleware } from "botbuilder-teams-messagingextensions";

// Initialize debug logging module
const log = debug("msteams");

/**
 * Implementation for search Bot
 */
@BotDeclaration(
    "/api/messages",
    new MemoryStorage(),
    process.env.MICROSOFT_APP_ID,
    process.env.MICROSOFT_APP_PASSWORD)

export class SearchMessageExtensionBot implements IBot {
    private readonly conversationState: ConversationState;
    /**
     * Local property for Search
     */
    @MessageExtensionDeclaration("searchMessageExtension")
    private _searchMessageExtension: SearchMessageExtension;
    private readonly dialogs: DialogSet;
    private dialogState: StatePropertyAccessor<DialogState>;
    private readonly activityProc = new TeamsActivityProcessor();

    /**
     * The constructor
     * @param conversationState
     */
    public constructor(conversationState: ConversationState, adapter: any) { // should be adapter: TeamsAdapter but this doesn't compile. Once changes to botbuilder-teams-messagingextensions are integrated, should be able to change back
        // Message extension Search
        this._searchMessageExtension = new SearchMessageExtension();
        adapter.use(new MessagingExtensionMiddleware(undefined, this._searchMessageExtension));

        this.conversationState = conversationState;
        this.dialogState = conversationState.createProperty("dialogState");
        this.dialogs = new DialogSet(this.dialogState);
    }
    
    /**
     * The Bot Framework `onTurn` handler.
     * The Microsoft Teams middleware for Bot Framework uses a custom activity processor (`TeamsActivityProcessor`)
     * which is configured in the constructor of this sample
     */
    public async onTurn(context: TurnContext): Promise<any> {
        // transfer the activity to the TeamsActivityProcessor
        await this.activityProc.processIncomingActivity(context);
    }

}
