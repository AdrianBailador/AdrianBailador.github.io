import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const postsDir = path.resolve('./src/content/blog');
const outputFile = path.resolve('./public/posts.json');

function getPostsFromDir(dir) {
  const folders = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isDirectory());
  let posts = [];

  for (const folder of folders) {
    const postFile = path.join(dir, folder.name, 'index.md');
    if (fs.existsSync(postFile)) {
      const content = fs.readFileSync(postFile, 'utf-8');
      const { data } = matter(content);

      if (data.title && data.summary) {
        const url = `/blog/${folder.name}`;

        posts.push({
          title: data.title,
          summary: data.summary,
          url
        });
      }
    }
  }

  return posts;
}

const posts = getPostsFromDir(postsDir);

fs.writeFileSync(outputFile, JSON.stringify(posts, null, 2), 'utf-8');
console.log(`✅ posts.json generated with ${posts.length} posts`);
