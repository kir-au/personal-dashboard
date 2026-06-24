'use client';

import { useState } from 'react';
import MarkdownModal from './MarkdownModal';

export default function TestModal() {
  const [showModal, setShowModal] = useState(false);

  const testFile = {
    name: 'test.md',
    path: '/test/path/test.md',
    relativePath: 'test/path/test.md',
    size: 1024,
    mtime: Date.now()
  };

  const testContent = {
    content: '# Test Markdown\n\nThis is a **test** markdown file.\n\n```javascript\nconsole.log("Hello World");\n```',
    frontmatter: {
      title: 'Test File',
      created: '2024-01-01',
      updated: '2024-01-02'
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Modal Component</h1>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Open Markdown Modal
      </button>

      {showModal && (
        <MarkdownModal
          file={testFile}
          content={testContent}
          loading={false}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
