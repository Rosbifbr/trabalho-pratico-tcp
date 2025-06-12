export default class TextParser {
  constructor(file) {
    this.file = file;
    this.text = "";
    this.index = 0;
  }

  async open() {
    this.text = await this.#readFile(this.file);
    this.index = 0;
  }

  #readFile(f) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(f);
    });
  }

  readNextChar() {
    return this.isEOF() ? null : this.text[this.index++];
  }

  peekCharAt(offset) {
    const peekIndex = this.index + offset;
    if (peekIndex < 0 || peekIndex >= this.text.length) {
      return null;
    }
    return this.text[peekIndex];
  }

  peekNextChar() {
    return this.peekCharAt(0);
  }

  isEOF() {
    return this.index >= this.text.length;
  }

  close() {
    this.text = "";
    this.index = 0;
  }
}
