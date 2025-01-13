import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const data = {
    name: 'james',
    description: 'James?',
};

export async function execute(interaction) {
    const imagePath = path.join(__dirname, '../james/James_1.png'); // Construct the absolute path

    try {
        await interaction.reply({
            content: "James",
            files: [imagePath],
        });
    } catch (error) {
        console.error("Failed to send the image:", error);
    }
}
