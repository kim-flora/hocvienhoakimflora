from html.parser import HTMLParser
from pathlib import Path
import hashlib, json, sys

class Ranges(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0] + [i + 1 for i, c in enumerate(source) if c == '\n']
        self.stack = []
        self.spans = []
        self.page = None
        self.lesson = None
        self.counts = {}

    def source_offset(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag not in ('section', 'div'):
            return
        attrs = dict(attrs)
        classes = attrs.get('class', '').split()
        key = None
        if tag == 'section' and 'knowledge-page' in classes:
            if self.page:
                raise ValueError('Nested module')
            self.page = attrs['id']
            key = self.page
        elif self.page and not self.lesson and tag == 'div' and 'knowledge-content' in classes:
            idx = self.counts.get(self.page, 0)
            self.counts[self.page] = idx + 1
            self.lesson = f'{self.page}/{idx}'
            key = self.lesson
        self.stack.append((tag, key, self.source_offset()))

    def handle_endtag(self, tag):
        if tag not in ('section', 'div'):
            return
        if tag == "section":
            while self.stack and self.stack[-1][0] == "div" and not self.stack[-1][1]:
                self.stack.pop()
        if not self.stack or self.stack[-1][0] != tag:
            if self.page:
                raise ValueError(f'Unbalanced {tag} in {self.page}')
            return
        _, key, start = self.stack.pop()
        if key:
            end = self.source.index('>', self.source_offset()) + 1
            self.spans.append((key, start, end))
            if key == self.lesson:
                self.lesson = None
            elif key == self.page:
                self.page = None

def manifest(source):
    parser = Ranges(source)
    parser.feed(source)
    parser.close()
    if parser.page or not parser.spans:
        raise ValueError('Incomplete document')
    return {'sha256': hashlib.sha256(source.encode()).hexdigest(),
            'spans': sorted(parser.spans, key=lambda s: s[1])}

if __name__ == '__main__':
    source = Path(sys.argv[1]).read_bytes().decode()
    print(json.dumps(manifest(source), separators=(',', ':')))
