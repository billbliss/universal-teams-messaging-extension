import { debug } from "debug";
import { CardFactory, Attachment } from "botbuilder";
import { MessagingExtensionResult, MessagingExtensionQuery, MessagingExtensionAttachment } from "botbuilder-teams";
import * as request from "request-promise-lite";
import * as stjs from "stjs";
import * as jsonPath from "jsonpath";
import * as fillTemplate from "es6-dynamic-template";
import * as sanitizeHtml from "sanitize-html";
import * as htmlEntity from "he";

import * as mcasCatalog from "./mcas-catalog.json";
import * as wikipedia from "./wikipedia.json";
import * as crunchbaseOrgs from "./crunchbase-orgs.json";
import * as crunchbasePeople from "./crunchbase-people.json";

const Providers = {
    "mcas": mcasCatalog,
    "wikipedia": wikipedia,
    "crunchbaseOrgs": crunchbaseOrgs,
    "crunchbasePeople": crunchbasePeople
}

var log = debug("resultsProvider");

enum ImageType {
    inline = "inline",
    indirect = "indirect",
    lookup = "lookup"
}

export class ResultsProvider {
    private _currentProvider: any;
    private _endPoint: string;
    private _cardTemplate: Attachment;
    private _imageEndPoint: string;
    private _imageUrlPath = "_injectedImageUrl";

    public constructor(commandId: string) {
        this._currentProvider = Providers[commandId];

        // Replace STJS template variable syntax with ES6 syntax, e.g. {{query}} -> ${query}
        this._endPoint = this._currentProvider.endPoint.replace(/{{([a-zA-Z0-9]+)}}/g, "${$1}");
        // Set card template
        switch (this._currentProvider.template) {
            case "imageCard":
                this._cardTemplate = imageCardTemplate;
                break;
            default:
                this._cardTemplate = defaultCardTemplate;
        }
        if (this._currentProvider.imageEndPoint !== undefined) {
            this._imageEndPoint = this._currentProvider.imageEndPoint.replace(/{{([a-zA-Z0-9]+)}}/g, "${$1}");
        }
        if (this._currentProvider.imagesType !== ImageType.indirect) {
            this._imageUrlPath = this._currentProvider.imageUrlPath;
        }

        // Replace environment placeholders in apiKey and header values
        if (this._currentProvider.apiKey !== undefined) {
            this._currentProvider.apiKey = this.envReplace(this._currentProvider.apiKey);
        }
        if (this._currentProvider.headers !== undefined) {
            for (var h in this._currentProvider.headers) {
                this._currentProvider.headers[h] = this.envReplace(this._currentProvider.headers[h]);
            }
        }
    }

    // Helper function to generate a string date from a Unix timestamp
    private unixTimestampAsDateString(unixTimestamp) {
        const dateFormat = {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
        const region = "en-US";

        if (unixTimestamp === null) {
            return "—";
        }
        else {
            return new Date(unixTimestamp * 1000).toLocaleDateString(region, dateFormat);
        }
    }

    // Helper function that replaces ${FOO} with the value of the FOO environment variable
    private envReplace(str: string): string {
        const es6TemplateRegex = /\${([A-Z0-9_-]+)}/;
        let envMatch = es6TemplateRegex.exec(str);
        if (envMatch === null) {
            // No ES6 templates in str, return str unmodified
            return str;
        }
        else {
            // Find first ES6 template match, replace it
            let obj = {};
            obj[envMatch[1]] = process.env[envMatch[1]];
            return fillTemplate(str, obj);
        }
    }

    private getRequestOptions():request.IRequestOptions {
        let requestOptions: request.IRequestOptions = 
        {
            json: true,
            headers: { },
            logger: log as any
        }

        if (this._currentProvider.apiKey !== undefined) {
            let authHeader = { Authorization: `${this._currentProvider.apiKeyPrefix}${this._currentProvider.apiKey}` };
            requestOptions.headers = {...authHeader};
            // $TODO - investigate other types of auth patterns (and no auth at all)
        }
        if (this._currentProvider.headers !== undefined) {
            requestOptions.headers = { ...requestOptions.headers, ...this._currentProvider.headers };
        }
        return requestOptions;
    }

    public async getResults(query: MessagingExtensionQuery): Promise<MessagingExtensionResult> {
        let queryString = query.parameters![0].value;
        let count = query.queryOptions!.count;
        let skip = query.queryOptions!.skip;

        let countParamName = (this._currentProvider.countParam !== undefined) ? this._currentProvider.countParam : "count";
        let skipParamName = (this._currentProvider.skipParam !== undefined) ? this._currentProvider.skipParam : "skip";
        let queryParams = {};
        queryParams["query"] = encodeURIComponent(queryString);
        queryParams[countParamName] = count;
        queryParams[skipParamName] = skip;

        let requestOptions = this.getRequestOptions();

        switch (this._currentProvider.httpMethod) {
            case "POST": {
                requestOptions.body = stjs.select(queryParams)
                    .transformWith(this._currentProvider.httpBodyTemplate)
                    .root();
                return new Promise((resolve, reject) => {
                    request.post(this._endPoint, requestOptions)
                        .then((response) => {
                            let rawResults: any[] = jsonPath.query(response as any, this._currentProvider.resultsPath);
                            let results = this.generateMsgExtResults(rawResults);
                            resolve(results);
                        })
                        .catch((err) => {
                            log(err);
                            reject();
                        });
                });
                break;
            }
            case "GET": {
                let uri = fillTemplate(this._endPoint, queryParams);
                return new Promise((resolve, reject) => {
                    request.get(uri, requestOptions)
                        .then((response) => {
                            let rawResults: any[] = jsonPath.query(response as any, this._currentProvider.resultsPath);
                            let results = this.generateMsgExtResults(rawResults);
                            resolve(results);
                        })
                        .catch((err) => {
                            log(`${err.message}: ${err.response.message}`);
                            reject();
                        });
                })
                break;
            }
            default: {
                throw new TypeError(`Invalid value for results provider .httpMethod: ${this._currentProvider.httpMethod}`);
            }
        }
    }

    // Inject the image URL as if it was in the original payload
    private injectImageUrl(result: any): any {
        let idPath = `$.${this._currentProvider.imageIdPath}`;
        let imageId = jsonPath.query(result, idPath)[0];
        result[this._imageUrlPath] = fillTemplate(this._currentProvider.imageIdUrl, { id: imageId });
        return result;
    }

    private async generateMsgExtResults(results: any[]): Promise<MessagingExtensionResult> {
        let msgExtResult: MessagingExtensionResult = {
            type: "result",
            attachmentLayout: "list",
            attachments: []
        }
        let attachmentPromises: Promise<MessagingExtensionAttachment>[] = [];
        for (var i = 0; i < results.length; i++) {
            attachmentPromises.push(this.generateMsgExtAttachment(results[i]));
        }
        await Promise.all(attachmentPromises)
            .then((values) => {
                msgExtResult.attachments = values;
            });
        return msgExtResult;
    }

    private generateMsgExtAttachment(result: any): Promise<MessagingExtensionAttachment> {
        const titlePath = `$.${this._currentProvider.titlePath}`;
        const descriptionPath = `$.${this._currentProvider.descriptionPath}`;
        const imageUrlPath = `$.${this._imageUrlPath}`;
        const detailsUrlPath = `$.${this._currentProvider.detailsUrlPath}`;
        let title = "";
        let imageUrl = "";
        let description = "";

        let facts = stjs.select(factsTemplate)
            .transform({ "facts": this._currentProvider.facts })
            .root()
            .facts;
        // Retrieve the JSON paths for the facts and set the values
        for (let i = 0; i < facts.length; i++) {
            let val = jsonPath.query(result, `$.${this._currentProvider.facts[i].path}`)[0];
            if (val === null) {
                facts[i].value = "Unknown";
            }
            else {
                switch (this._currentProvider.facts[i].format) {
                    case "url":
                        // Format as Markdown
                        facts[i].value = `[${this._currentProvider.facts[i].label}](${val})`;
                        break;
                    case "unixtimestamp":
                        facts[i].value = this.unixTimestampAsDateString(val);
                        break;
                    case undefined: // the most common case - not specified
                        facts[i].value = val;
                        break;
                }
            }
        }

        // If there is no facts array in the provider, the facts table in the template will contain template data, 
        // which doesn't work (the card won't render). Reset it if needed.
        if (this._currentProvider.facts === undefined) {
            facts = [];
        }

        return new Promise(async (resolve, reject) => {
            // Inject imageUrl into result if needed
            if (this._currentProvider.imagesType === ImageType.indirect) {
                result = this.injectImageUrl(result);
            }
            
            if (this._currentProvider.imagesType === ImageType.lookup) {
                // Call imageEndpoint to retrieve image URLs
                let imageId = encodeURIComponent(jsonPath.query(result, `$.${this._currentProvider.imageIdPath}`)[0]);
                let imageRequestUrl = fillTemplate(this._imageEndPoint, { id: imageId });
                let requestOptions = this.getRequestOptions();
                // Call the imageEndPoint and wait for it to return to extract the imageUrl
                let response = await request.get(imageRequestUrl, requestOptions)
                    .then((response) => {
                        return(response);
                    })
                    .catch((err) => {
                        log(err);
                        reject();
                    })
                imageUrl = jsonPath.query(response, this._currentProvider.imageUrlPath)[0];
            }
            else {
                imageUrl = jsonPath.query(result, imageUrlPath)[0];   
            }
            // If imageUrl doesn't exist, use a default
            imageUrl = (imageUrl === undefined) ? this._currentProvider.imageDefault : imageUrl;

            title = jsonPath.query(result, titlePath)[0];
            if (this._currentProvider.title2Path !== undefined) {
                title = `${title} ${jsonPath.query(result, this._currentProvider.title2Path)[0]}`;
            }
            description = jsonPath.query(result, descriptionPath)[0];
            if (this._currentProvider.descriptionFormat !== undefined && this._currentProvider.descriptionFormat === "html") {
                description = htmlEntity.decode(sanitizeHtml(description));
            }
            if (this._currentProvider.descriptionSuffix !== undefined) {
                description = description + this._currentProvider.descriptionSuffix;
            }
            let data = {
                title: title,
                description: description,
                imageUrl: imageUrl,
                detailsUrl: fillTemplate(this._currentProvider.detailsUrlTemplate, { id: encodeURIComponent(jsonPath.query(result, detailsUrlPath)[0]) }),
                facts: facts
            }
            // Generate card portion of the attachment
            let card: MessagingExtensionAttachment = stjs.select(data)
                .transformWith(this._cardTemplate)
                .root();
            // Set the preview object
            card.preview = stjs.select(data)
                .transformWith(previewTemplate)
                .root();
            resolve(card);
        });
    }
}

const defaultCardTemplate: Attachment = CardFactory.adaptiveCard(
    {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "TextBlock",
                "size": "Large",
                "text": "{{title}}"
            },
            {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "items": [
                            {
                                "type": "Image",
                                "url": "{{imageUrl}}",
                                "size": "medium"
                            }
                        ],
                        "width": "auto"
                    },
                    {
                        "type": "Column",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": "{{description}}",
                                "wrap": true
                            }
                        ],
                        "width": "stretch"
                    }
                ]
            },
            {
                "type": "FactSet",
                "facts": "{{facts}}"
            }
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "More details",
                "url": "{{detailsUrl}}"
            }
        ],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.0"
    }
);

const imageCardTemplate: Attachment = CardFactory.adaptiveCard(
    {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "TextBlock",
                "size": "Large",
                "text": "{{title}}"
            },
            {
                "type": "Image",
                "url": "{{imageUrl}}",
                "size": "Stretch",
            },
            {
                "type": "TextBlock",
                "text": "{{description}}",
                "wrap": true
            },
            {
                "type": "FactSet",
                "facts": "{{facts}}"
            }
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "More details",
                "url": "{{detailsUrl}}"
            }
        ],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.0"
    }
);

const previewTemplate: Attachment = {
    contentType: "application/vnd.microsoft.card.thumbnail",
    content: {
        title: "{{title}}",
        text: "{{description}}",
        images: [
            {
                url: "{{imageUrl}}"
            }
        ]
    }
}

const factsTemplate = {
    "facts": {
        "{{#each facts}}": {
            "title": "{{label}}",
            "value": "{{path}}"
        }
    }
}