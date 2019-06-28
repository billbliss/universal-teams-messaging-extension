import { ResultsProvider } from "../ResultsProvider";

describe("ResultsProvider component", () => {
    // Test Unix time/date conversion - $TODO - remove once unit tests for specific providers are implemented
    it("should accurately convert a Unix timestamp to a string in the format 'Month, DayOfMonth, Year'", () => {
        const ts = 1561735805; // 06/28/2019 3:30 PM UTC
        const rp = new ResultsProvider("wikipedia");
        expect(rp.unixTimestampAsDateString(ts)).toBe("June 28, 2019");
    });

    // Test Unix time/date conversion - $TODO - remove once unit tests for specific providers are implemented
    it("should accurately render a null Unix timestamp as an em dash", () => {
        const ts = null;
        const rp = new ResultsProvider("wikipedia");
        expect(rp.unixTimestampAsDateString(ts)).toBe("—"); // em dash, not a normal dash
    });

    it("should accurately retrieve API_KEY for a provider from the environment", () => {
        process.env["MCAS_API_KEY"] = "12345";
        const rp = new ResultsProvider("mcas");
        expect(rp.getProviderValue("apiKey")).toBe("Token 12345");
        process.env["MCAS_API_KEY"] = "";
    });

    it("should accurately insert values from the environment into provider HTTP headers", () => {
        process.env["RAPID_API_KEY"] = "12345";
        const rp = new ResultsProvider("crunchbaseOrgs");
        expect(rp.getProviderValue("headers")["X-RapidAPI-Key"]).toBe("12345");
        process.env["RAPID_API_KEY"] = "";
    });

});