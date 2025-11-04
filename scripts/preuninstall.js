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

console.log("🗑️  开始清理 Cursor 命令和规则文档...");

// 删除文件或目录
function removeItem(itemPath) {
	try {
		if (fs.existsSync(itemPath)) {
			const stat = fs.statSync(itemPath);
			if (stat.isDirectory()) {
				// 递归删除目录
				fs.rmSync(itemPath, { recursive: true, force: true });
				console.log(`🗑️  删除目录: ${path.relative(homeDir, itemPath)}`);
			} else {
				// 删除文件
				fs.unlinkSync(itemPath);
				console.log(`🗑️  删除文件: ${path.relative(homeDir, itemPath)}`);
			}
			return true;
		}
	} catch (error) {
		console.error(
			`❌ 删除失败 ${path.relative(homeDir, itemPath)}:`,
			error.message
		);
	}
	return false;
}

// 获取源目录的文件和目录列表（递归）
function getSourceItems(sourceDir) {
	const items = new Set();

	function scanDir(dir) {
		if (!fs.existsSync(dir)) return;

		const files = fs.readdirSync(dir);
		files.forEach((file) => {
			const fullPath = path.join(dir, file);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				// 记录目录名
				items.add(file);
				// 递归扫描子目录
				scanDir(fullPath);
			} else {
				// 记录文件名
				items.add(file);
			}
		});
	}

	scanDir(sourceDir);
	return items;
}

// 检查目录是否只包含项目文件
function isDirectoryOnlyProjectFiles(dir, sourceItems) {
	try {
		if (!fs.existsSync(dir)) return false;

		const items = fs.readdirSync(dir);
		if (items.length === 0) return true; // 空目录算作只包含项目文件

		for (const item of items) {
			const fullPath = path.join(dir, item);
			const stat = fs.statSync(fullPath);

			if (stat.isDirectory()) {
				// 如果子目录不匹配项目目录，说明包含非项目内容
				if (!sourceItems.has(item)) {
					return false;
				}
				// 递归检查子目录
				if (!isDirectoryOnlyProjectFiles(fullPath, sourceItems)) {
					return false;
				}
			} else {
				// 如果文件不匹配项目文件，说明包含非项目内容
				if (!sourceItems.has(item)) {
					return false;
				}
			}
		}
		return true;
	} catch (error) {
		console.error(`❌ 检查目录内容失败 ${dir}:`, error.message);
		return false;
	}
}

// 递归删除目标目录中匹配的项
function cleanupDirectory(sourceDir, targetDir) {
	try {
		if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
			console.log(`⚠️  源目录或目标目录不存在，跳过清理: ${sourceDir}`);
			return 0;
		}

		// 获取源目录中的所有文件和目录名
		const sourceItems = getSourceItems(sourceDir);

		if (sourceItems.size === 0) {
			console.log(`⚠️  源目录为空，跳过清理: ${sourceDir}`);
			return 0;
		}

		// 递归删除目标目录中匹配的项
		let deletedCount = 0;

		function scanAndDelete(dir) {
			if (!fs.existsSync(dir)) return;

			const items = fs.readdirSync(dir);
			items.forEach((item) => {
				const fullPath = path.join(dir, item);
				const stat = fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// 如果是目录且在源目录中存在
					if (sourceItems.has(item)) {
						// 检查目录是否只包含项目文件
						if (isDirectoryOnlyProjectFiles(fullPath, sourceItems)) {
							// 只包含项目文件，删除整个目录
							if (removeItem(fullPath)) {
								deletedCount++;
							}
						} else {
							// 包含非项目文件，递归清理内部的匹配项
							scanAndDelete(fullPath);
						}
					} else {
						// 目录名不匹配，递归检查子目录
						scanAndDelete(fullPath);
					}
				} else {
					// 如果是文件且在源目录中存在，删除文件
					if (sourceItems.has(item)) {
						if (removeItem(fullPath)) {
							deletedCount++;
						}
					}
				}
			});
		}

		scanAndDelete(targetDir);
		return deletedCount;
	} catch (error) {
		console.error(`❌ 清理目录时出现错误 ${sourceDir}:`, error.message);
		return 0;
	}
}

// 清理命令文档
function cleanupCommands() {
	console.log(`📂 清理命令文档...`);
	const deletedCount = cleanupDirectory(sourceCommandsDir, cursorCommandsDir);
	console.log(`✅ 已清理 ${deletedCount} 个命令文档项`);
	return deletedCount;
}

// 清理规则文档
function cleanupRules() {
	console.log(`📂 清理规则文档...`);
	const deletedCount = cleanupDirectory(sourceRulesDir, cursorRulesDir);
	console.log(`✅ 已清理 ${deletedCount} 个规则文档项`);
	return deletedCount;
}

// 主执行函数
function main() {
	const cursorDir = path.join(homeDir, ".cursor");
	console.log(`📍 清理目录: ${cursorDir}`);
	if (platform === "win32") {
		console.log(`💻 检测到 Windows 系统，路径将使用 Windows 格式`);
	}

	const commandsDeleted = cleanupCommands();
	const rulesDeleted = cleanupRules();

	console.log("🎉 Cursor 命令和规则文档清理完成！");
	console.log(`💡 共清理了 ${commandsDeleted + rulesDeleted} 个文档项`);
}

main();
