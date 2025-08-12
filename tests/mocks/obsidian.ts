// Mock Obsidian API for tests
export const App = jest.fn();
export const Plugin = jest.fn();
export const Notice = jest.fn();
export const Setting = jest.fn();
export const ItemView = jest.fn();
export const WorkspaceLeaf = jest.fn();
export const moment = {
    locale: jest.fn(() => 'en')
};

export default {
    App,
    Plugin,
    Notice,
    Setting,
    ItemView,
    WorkspaceLeaf,
    moment
};