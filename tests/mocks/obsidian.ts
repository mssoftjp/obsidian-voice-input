// Mock Obsidian API for tests
export class TFile {
  constructor(public path: string) {}
}

export class Vault {
  async read(): Promise<string> {
    return '';
  }
  
  async create(): Promise<TFile> {
    return new TFile('mock.md');
  }
}

export class App {
  vault = new Vault();
}

export class Plugin {
  app = new App();
  
  async loadData(): Promise<any> {
    return null;
  }
  
  async saveData(): Promise<void> {
    // Mock implementation
  }
}

export class Component {
  // Mock component
}

export class ItemView {
  // Mock item view
}

export class WorkspaceLeaf {
  // Mock workspace leaf
}