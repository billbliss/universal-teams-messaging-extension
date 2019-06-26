import * as React from "react";
import { shallow } from "enzyme";
import toJson from "enzyme-to-json";

import { SearchMessageExtensionConfig } from "../SearchMessageExtensionConfig";

describe("SearchMessageExtensionConfig Component", () => {
    // Snapshot Test Sample
    it("should match the snapshot", () => {
        const wrapper = shallow(<SearchMessageExtensionConfig />);
        expect(toJson(wrapper)).toMatchSnapshot();
    });

    // Component Test Sample
    it("should render the tab", () => {
        const component = shallow(<SearchMessageExtensionConfig />);
        const divResult = component.containsMatchingElement(<div>lookup configuration</div>);

        expect(divResult).toBeTruthy();
    });
});


