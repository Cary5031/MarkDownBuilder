export namespace main {
	
	export class Document {
	    path: string;
	    content: string;
	    encoding: string;
	    crlf: boolean;
	    bom: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Document(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.content = source["content"];
	        this.encoding = source["encoding"];
	        this.crlf = source["crlf"];
	        this.bom = source["bom"];
	    }
	}
	export class ImportTarget {
	    markdownPath: string;
	    assetsDir: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportTarget(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.markdownPath = source["markdownPath"];
	        this.assetsDir = source["assetsDir"];
	    }
	}
	export class Settings {
	    language: string;
	    defaultPrompt: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	        this.defaultPrompt = source["defaultPrompt"];
	    }
	}

}

