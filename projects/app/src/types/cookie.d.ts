declare module 'cookie' {
  export function parse(str: string): Record<string, string>;
}
