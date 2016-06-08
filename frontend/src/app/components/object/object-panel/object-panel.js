import template from './object-panel.html';
import ko from 'knockout';
import { uiState, objectInfo, objectPartList } from 'model';

class ObjectPanelViewModel {
    constructor() {
        this.obj = objectInfo;
        this.parts  = objectPartList;

        this.ready = ko.pureComputed(
            () => !!this.obj()
        );

        this.selectedTab = ko.pureComputed(
            () => uiState().tab
        );
    }

    isTabSelected(name) {
        return this.selectedTab() === name;
    }
}

export default {
    viewModel: ObjectPanelViewModel,
    template: template
};
