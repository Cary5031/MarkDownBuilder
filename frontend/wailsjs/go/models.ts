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
	export class Settings {
	    language: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.language = source["language"];
	    }
	}

}

