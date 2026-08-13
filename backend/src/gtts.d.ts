declare module "gtts" {
    class GTTS {
      constructor(text: string, lang: string);
  
      stream(): NodeJS.ReadableStream;
  
      save(
        filename: string,
        callback?: (error?: Error) => void
      ): void;
    }
  
    export = GTTS;
  }