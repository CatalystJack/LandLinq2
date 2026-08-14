declare module 'mailparser' {
  export class MailParser {
    on(event: string, callback: (data: any) => void): void;
    write(data: Buffer): void;
    end(): void;
  }
  
  export function simpleParser(source: Buffer): Promise<any>;
}
