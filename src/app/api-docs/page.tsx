'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocs() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    // 在客户端加载Swagger规范
    fetch('/api/swagger')
      .then((response) => response.json())
      .then((data) => setSpec(data))
      .catch((err) => console.error('Failed to load API spec:', err));
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">API 文档</h1>
      {spec ? (
        <SwaggerUI spec={spec} />
      ) : (
        <div className="flex justify-center items-center h-64">
          <p className="text-lg">加载API文档中...</p>
        </div>
      )}
    </div>
  );
}