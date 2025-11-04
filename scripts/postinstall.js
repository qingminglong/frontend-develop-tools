#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const homeDir = os.homedir();
const platform = os.platform();

// Windows 和 Linux/Mac 都支持相同的路径结构
const cursorCommandsDir = path.join(homeDir, ".cursor", "commands");
const cursorRulesDir = path.join(homeDir, ".cursor", "rules");
const sourceCommandsDir = path.resolve(__dirname, "..", "commands");
const sourceRulesDir = path.resolve(__dirname, "..", "rules");

console.log("🚀 开始安装 Cursor 命令和规则文档...");

// 确保目标目录存在
function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		console.log(`📁 创建目录: ${dirPath}`);
	}
}

// 递归复制目录
function copyDirectory(source, target) {
	try {
		// 确保目标目录存在
		ensureDirectoryExists(target);

		// 读取源目录内容
		const items = fs.readdirSync(source);

		let copiedCount = 0;
		items.forEach((item) => {
			const sourcePath = path.join(source, item);
			const targetPath = path.join(target, item);

			const stat = fs.statSync(sourcePath);

			if (stat.isDirectory()) {
				// 递归复制子目录
				copiedCount += copyDirectory(sourcePath, targetPath);
			} else {
				// 复制文件
				fs.copyFileSync(sourcePath, targetPath);
				const sourceRelative = path.relative(process.cwd(), sourcePath);
				const targetRelative = path.relative(homeDir, targetPath);
				console.log(`📄 复制文件: ${sourceRelative} -> ${targetRelative}`);
				copiedCount++;
			}
		});

		return copiedCount;
	} catch (error) {
		console.error(`❌ 复制目录失败 ${source}:`, error.message);
		return 0;
	}
}

// 安装命令文档
function installCommands() {
	try {
		if (!fs.existsSync(sourceCommandsDir)) {
			console.log("⚠️  commands目录不存在，跳过命令文档安装");
			return 0;
		}

		console.log(`📂 安装命令文档...`);
		// 确保目标目录存在
		ensureDirectoryExists(cursorCommandsDir);
		const copiedCount = copyDirectory(sourceCommandsDir, cursorCommandsDir);
		console.log(`✅ 成功安装 ${copiedCount} 个命令文档到 ${cursorCommandsDir}`);
		return copiedCount;
	} catch (error) {
		console.error("❌ 安装命令文档时出现错误:", error.message);
		return 0;
	}
}

// 安装规则文档
function installRules() {
	try {
		if (!fs.existsSync(sourceRulesDir)) {
			console.log("⚠️  rules目录不存在，跳过规则文档安装");
			return 0;
		}

		console.log(`📂 安装规则文档...`);
		// 确保目标目录存在
		ensureDirectoryExists(cursorRulesDir);
		const copiedCount = copyDirectory(sourceRulesDir, cursorRulesDir);
		console.log(`✅ 成功安装 ${copiedCount} 个规则文档到 ${cursorRulesDir}`);
		return copiedCount;
	} catch (error) {
		console.error("❌ 安装规则文档时出现错误:", error.message);
		return 0;
	}
}

// 主执行函数
function main() {
	const cursorDir = path.join(homeDir, ".cursor");
	console.log(`📍 目标目录: ${cursorDir}`);
	if (platform === "win32") {
		console.log(`💻 检测到 Windows 系统，路径将使用 Windows 格式`);
	}

	const commandsCount = installCommands();
	const rulesCount = installRules();

	console.log("🎉 Cursor 命令和规则文档安装完成！");
	console.log(
		`💡 共安装了 ${
			commandsCount + rulesCount
		} 个文档，您可以在 Cursor 中使用这些文档了`
	);
}

main();
