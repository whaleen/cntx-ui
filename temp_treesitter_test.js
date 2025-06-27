import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';

async function runTest() {
  const parser = new Parser();
  parser.setLanguage(JavaScript);

  const sourceCode = 'function add(a, b) { return a + b; }';
  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  console.log('Root Node Type:', rootNode.type);
  console.log('Root Node Text:', rootNode.text);
  console.log('Root Node hasError():', rootNode.hasError());

  // Try to access a child node
  const functionNode = rootNode.namedChild(0);
  if (functionNode) {
    console.log('Function Node Type:', functionNode.type);
    console.log('Function Node Text:', functionNode.text);
  }
}

runTest().catch(console.error);