import {
    type Action,
    type ActionExample,
    type Content,
    elizaLogger,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
} from "@elizaos/core";

export const deployCharacterAction: Action = {
    name: "DEPLOY_CHARACTER",
    similes: [
        "DEPLOY_NEW_CHARACTER",
        "CREATE_AND_DEPLOY_CHARACTER",
        "SPAWN_CHARACTER",
        "LAUNCH_CHARACTER",
        "CREATE_CHARACTER",
    ],
    description:
        "Creates a new character file from user input, then deploys an AI agent using Docker Compose and Coolify. Returns a link to the running instance.",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content.text.toLowerCase();

        elizaLogger.info("content in validate: ", content);

        elizaLogger.info("Validating message for character deployment...");

        const isValidate =
            (content.includes("deploy") && content.includes("character")) ||
            (content.includes("create") && content.includes("character")) ||
            (content.includes("spawn") && content.includes("agent"));
        elizaLogger.info("isValidate: ", isValidate ? "true" : "false");
        return isValidate;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options = {},
        callback?: HandlerCallback,
    ) => {
        let characterName = "";
        try {
            elizaLogger.info("Starting character deployment process...");

            // Extract character info from message
            characterName = extractCharacterName(message.content.text);
            const characterDescription = extractCharacterDescription(
                message.content.text,
            );
            elizaLogger.info(
                `Extracted character info - Name: ${characterName}, Description length: ${characterDescription.length}`,
            );

            // Initial status message
            if (callback) {
                elizaLogger.info(
                    `Sending initial status callback for ${characterName}`,
                );
                await callback({
                    text: `Starting deployment for character "${characterName}"...`,
                    action: "NONE",
                });
            }

            elizaLogger.info("Creating character file...");
            elizaLogger.info("CharacterName: ", characterName);
            elizaLogger.info("CharacterDescription: ", characterDescription);

            // Create character file
            try {
                elizaLogger.info(
                    `Starting character file creation for ${characterName}`,
                );
                await createCharacterFile(characterName, characterDescription);
                elizaLogger.info(
                    `Character file creation completed for ${characterName}`,
                );

                if (callback) {
                    elizaLogger.info(
                        `Sending file creation callback for ${characterName}`,
                    );
                    await callback({
                        text: `Character file created for ${characterName}. Starting deployment...`,
                        content: {
                            characterName,
                            status: "file_created",
                        },
                    });
                }
            } catch (error) {
                elizaLogger.error("Failed to create character file:", error);
                throw new Error(
                    `Failed to create character file: ${error.message}`,
                );
            }

            // Deploy with Coolify
            try {
                elizaLogger.info(
                    `Starting Coolify deployment for ${characterName}`,
                );
                await deployWithCoolify(characterName);
                elizaLogger.info(
                    `Coolify deployment initiated for ${characterName}`,
                );

                if (callback) {
                    elizaLogger.info(
                        `Sending deployment progress callback for ${characterName}`,
                    );
                    await callback({
                        text: `Deployment in progress for ${characterName}...`,
                        content: {
                            characterName,
                            status: "deploying",
                        },
                    });
                }
            } catch (error) {
                elizaLogger.error("Failed to deploy with Coolify:", error);
                throw new Error(`Deployment failed: ${error.message}`);
            }

            // Wait for deployment to be ready
            const MAX_RETRIES = 10;
            const RETRY_DELAY = 5000; // 5 seconds
            const deploymentLink = `https://mydomain.com/${characterName}`;
            elizaLogger.info(
                `Starting deployment status checks for ${characterName} at ${deploymentLink}`,
            );

            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    elizaLogger.info(
                        `Checking deployment status (attempt ${i + 1}/${MAX_RETRIES})`,
                    );
                    const isReady = await checkDeploymentStatus(deploymentLink);
                    elizaLogger.info(
                        `Deployment status check result: ${isReady ? "ready" : "not ready"}`,
                    );

                    if (isReady) {
                        elizaLogger.info(
                            `Deployment successful for ${characterName}`,
                        );
                        // Final success response
                        return {
                            message: `Your new character "${characterName}" is now running at ${deploymentLink}\n\nDescription: ${characterDescription}`,
                            action: "DEPLOY_CHARACTER",
                            content: {
                                characterName,
                                deploymentLink,
                                description: characterDescription,
                                success: true,
                                status: "completed",
                            },
                        };
                    }
                } catch (error) {
                    elizaLogger.warn(
                        `Deployment check attempt ${i + 1} failed:`,
                        error,
                    );
                }

                // Progress update
                if (callback) {
                    elizaLogger.info(
                        `Sending retry status callback (attempt ${i + 1}/${MAX_RETRIES})`,
                    );
                    await callback({
                        text: `Still waiting for deployment to be ready... (attempt ${i + 1}/${MAX_RETRIES})`,
                        content: {
                            characterName,
                            status: "waiting",
                            attempt: i + 1,
                            maxAttempts: MAX_RETRIES,
                        },
                    });
                }

                elizaLogger.info(
                    `Waiting ${RETRY_DELAY}ms before next check...`,
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY),
                );
            }

            elizaLogger.error(
                `Deployment timed out for ${characterName} after ${MAX_RETRIES} attempts`,
            );
            throw new Error("Deployment timed out");
        } catch (error) {
            elizaLogger.error(`Deployment failed for ${characterName}:`, error);

            // Error response
            return {
                message: `Failed to deploy character "${characterName}": ${error.message}`,
                action: "DEPLOY_CHARACTER",
                content: {
                    characterName,
                    error: error.message,
                    success: false,
                    status: "failed",
                },
            };
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you deploy a new character called CyberKnight that's a cyberpunk warrior?",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Deploying your CyberKnight character now...",
                    action: "DEPLOY_CHARACTER",
                    content: {
                        characterName: "CyberKnight",
                        deploymentLink: "https://mydomain.com/CyberKnight",
                        success: true,
                    },
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please create and deploy a wise professor character named Sage",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: 'Your new character "Sage" is now running at https://mydomain.com/Sage',
                    action: "DEPLOY_CHARACTER",
                    content: {
                        characterName: "Sage",
                        deploymentLink: "https://mydomain.com/Sage",
                        success: true,
                    },
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I need a customer service bot named Helper",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Deploying Helper, your customer service assistant...",
                    action: "DEPLOY_CHARACTER",
                    content: {
                        characterName: "Helper",
                        deploymentLink: "https://mydomain.com/Helper",
                        success: true,
                    },
                },
            },
        ],
    ] as ActionExample[][],
};

// Helper functions
function extractCharacterName(text: string): string {
    // Add logic to extract name from text
    return "ExampleName";
}

function extractCharacterDescription(text: string): string {
    // Add logic to extract description from text
    return "Example description";
}

async function createCharacterFile(name: string, description: string) {
    // Implementation for creating character file
}

async function deployWithCoolify(characterName: string) {
    // Implementation for deploying with Coolify
}

// Add this helper function
async function checkDeploymentStatus(deploymentLink: string): Promise<boolean> {
    try {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return true;
    } catch (error) {
        elizaLogger.error("Deployment status check failed:", error);
        return false;
    }

    // try {
    //     // Implement actual health check logic here
    //     const response = await fetch(deploymentLink);
    //     return response.status === 200;
    // } catch (error) {
    //     elizaLogger.error("Deployment status check failed:", error);
    //     return false;
    // }
}
