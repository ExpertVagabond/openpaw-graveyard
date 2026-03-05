use clap::{Parser, Subcommand};
use serde_json::{json, Value};

#[derive(Parser)]
#[command(name = "openpaw", about = "Autonomous AI agent with onchain social identity on Solana")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create or verify onchain profile
    Profile,
    /// Post to Tapestry + Moltbook
    Post { text: String },
    /// View activity feed
    Feed,
    /// Follow a profile
    Follow { profile_id: String },
    /// Check wallet balance
    Balance,
    /// Swap tokens via Bankr
    Swap { from: String, to: String, amount: String },
    /// Get all agent stats
    Stats,
    /// Full heartbeat cycle
    Heartbeat,
    /// Discover and follow new profiles
    Discover,
    /// Engage with trending content
    Engage,
    /// Run daemon mode
    Run {
        #[arg(long, default_value_t = 30)]
        interval: u64,
        #[arg(long, default_value_t = 100)]
        max_cycles: u64,
    },
    /// Wallet snapshot via Helius
    Wallet,
    /// Generate text with local LLM
    Llm { prompt: String },
    /// Scan for flash loan opportunities
    FlashScan,
    /// Check Moltbook DMs
    Dms,
    /// Send a DM
    SendDm { agent_id: String, message: String },
}

struct Config {
    tapestry_url: String,
    tapestry_key: String,
    bankr_url: String,
    bankr_key: String,
    moltbook_url: String,
    moltbook_key: String,
    helius_rpc: String,
    ollama_url: String,
    wallet: String,
    agent_name: String,
}

impl Config {
    fn from_env() -> Self {
        Self {
            tapestry_url: std::env::var("TAPESTRY_API_URL").unwrap_or_else(|_| "https://api.tapestry.so/api/v1".into()),
            tapestry_key: std::env::var("TAPESTRY_API_KEY").unwrap_or_default(),
            bankr_url: std::env::var("BANKR_API_URL").unwrap_or_else(|_| "https://api.bankr.bot".into()),
            bankr_key: std::env::var("BANKR_API_KEY").unwrap_or_default(),
            moltbook_url: std::env::var("MOLTBOOK_API_URL").unwrap_or_else(|_| "https://moltbook.com/api".into()),
            moltbook_key: std::env::var("MOLTBOOK_API_KEY").unwrap_or_default(),
            helius_rpc: std::env::var("HELIUS_RPC_URL").unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".into()),
            ollama_url: std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".into()),
            wallet: std::env::var("SOLANA_WALLET").unwrap_or_default(),
            agent_name: std::env::var("AGENT_NAME").unwrap_or_else(|_| "OpenPaw_PSM".into()),
        }
    }
}

// --- API Clients ---

async fn tapestry_get(cfg: &Config, client: &reqwest::Client, path: &str) -> Value {
    match client.get(format!("{}{}", cfg.tapestry_url, path))
        .header("x-api-key", &cfg.tapestry_key)
        .send().await {
        Ok(r) => r.json().await.unwrap_or(json!({"error": "tapestry parse failed"})),
        Err(_) => json!({"error": "tapestry request failed"}),
    }
}

async fn tapestry_post(cfg: &Config, client: &reqwest::Client, path: &str, body: &Value) -> Value {
    match client.post(format!("{}{}", cfg.tapestry_url, path))
        .header("x-api-key", &cfg.tapestry_key)
        .json(body).send().await {
        Ok(r) => r.json().await.unwrap_or(json!({"error": "tapestry parse failed"})),
        Err(_) => json!({"error": "tapestry post failed"}),
    }
}

async fn moltbook_get(cfg: &Config, client: &reqwest::Client, path: &str) -> Value {
    match client.get(format!("{}{}", cfg.moltbook_url, path))
        .header("x-api-key", &cfg.moltbook_key)
        .send().await {
        Ok(r) => r.json().await.unwrap_or(json!({"error": "moltbook parse failed"})),
        Err(_) => json!({"error": "moltbook request failed"}),
    }
}

async fn moltbook_post(cfg: &Config, client: &reqwest::Client, path: &str, body: &Value) -> Value {
    match client.post(format!("{}{}", cfg.moltbook_url, path))
        .header("x-api-key", &cfg.moltbook_key)
        .json(body).send().await {
        Ok(r) => r.json().await.unwrap_or(json!({"error": "moltbook parse failed"})),
        Err(_) => json!({"error": "moltbook post failed"}),
    }
}

async fn bankr_ask(cfg: &Config, client: &reqwest::Client, prompt: &str) -> Value {
    let resp = client.post(format!("{}/prompt", cfg.bankr_url))
        .header("x-api-key", &cfg.bankr_key)
        .json(&json!({"prompt": prompt}))
        .send().await;
    let job_id = match resp {
        Ok(r) => r.json::<Value>().await.ok()
            .and_then(|v| v["jobId"].as_str().map(String::from)),
        Err(_) => None,
    };
    let Some(job_id) = job_id else { return json!({"error": "bankr submit failed"}); };

    // Poll for result
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let poll = match client.get(format!("{}/job/{}", cfg.bankr_url, job_id))
            .header("x-api-key", &cfg.bankr_key)
            .send().await {
            Ok(r) => r.json::<Value>().await.ok(),
            Err(_) => None,
        };
        if let Some(data) = poll {
            let status = data["status"].as_str().unwrap_or("");
            if status == "completed" { return data; }
            if status == "failed" { return json!({"error": "bankr job failed", "data": data}); }
        }
    }
    json!({"error": "bankr timeout"})
}

async fn solana_rpc(cfg: &Config, client: &reqwest::Client, method: &str, params: Value) -> Value {
    match client.post(&cfg.helius_rpc)
        .json(&json!({"jsonrpc":"2.0","id":1,"method":method,"params":params}))
        .send().await {
        Ok(r) => {
            let v: Value = r.json().await.unwrap_or(json!({}));
            v["result"].clone()
        }
        Err(_) => json!(null),
    }
}

async fn ollama_generate(cfg: &Config, client: &reqwest::Client, prompt: &str) -> String {
    let resp = client.post(format!("{}/api/generate", cfg.ollama_url))
        .json(&json!({"model":"llama3.2","prompt":prompt,"stream":false}))
        .send().await;
    match resp {
        Ok(r) => r.json::<Value>().await.ok()
            .and_then(|v| v["response"].as_str().map(String::from))
            .unwrap_or_else(|| "LLM unavailable".into()),
        Err(_) => "Ollama not running".into(),
    }
}

async fn wallet_snapshot(cfg: &Config, client: &reqwest::Client) -> Value {
    let balance = solana_rpc(cfg, client, "getBalance", json!([&cfg.wallet])).await;
    let tokens = solana_rpc(cfg, client, "getTokenAccountsByOwner",
        json!([&cfg.wallet, {"programId":"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}, {"encoding":"jsonParsed"}])).await;
    let sol = balance["value"].as_f64().unwrap_or(0.0) / 1e9;
    json!({"sol": sol, "tokens": tokens["value"], "wallet": &cfg.wallet})
}

// --- Command Handlers ---

async fn cmd_profile(cfg: &Config, client: &reqwest::Client) {
    let profile = tapestry_get(cfg, client, &format!("/profiles/search?query={}", cfg.agent_name)).await;
    println!("{}", serde_json::to_string_pretty(&profile).unwrap());
}

async fn cmd_post(cfg: &Config, client: &reqwest::Client, text: &str) {
    // Post to Tapestry
    let tap_result = tapestry_post(cfg, client, "/contents", &json!({
        "profileId": cfg.agent_name,
        "properties": {"text": text, "type": "post"}
    })).await;
    tracing::info!("Tapestry: {}", tap_result);

    // Cross-post to Moltbook
    let molt_result = moltbook_post(cfg, client, "/posts", &json!({
        "submoltId": "general",
        "title": &text[..text.len().min(80)],
        "content": text
    })).await;
    tracing::info!("Moltbook: {}", molt_result);
}

async fn cmd_feed(cfg: &Config, client: &reqwest::Client) {
    let tap_feed = tapestry_get(cfg, client, &format!("/activity/{}", cfg.agent_name)).await;
    let molt_hot = moltbook_get(cfg, client, "/posts/hot?limit=10").await;
    println!("=== Tapestry Feed ===\n{}\n=== Moltbook Trending ===\n{}",
        serde_json::to_string_pretty(&tap_feed).unwrap(),
        serde_json::to_string_pretty(&molt_hot).unwrap());
}

async fn cmd_balance(cfg: &Config, client: &reqwest::Client) {
    let result = bankr_ask(cfg, client, "What is my balance on all chains?").await;
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
}

async fn cmd_swap(cfg: &Config, client: &reqwest::Client, from: &str, to: &str, amount: &str) {
    let prompt = format!("Swap {amount} {from} to {to}");
    let result = bankr_ask(cfg, client, &prompt).await;
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
}

async fn cmd_stats(cfg: &Config, client: &reqwest::Client) {
    let wallet = wallet_snapshot(cfg, client).await;
    let profile = tapestry_get(cfg, client, &format!("/profiles/search?query={}", cfg.agent_name)).await;
    println!("{}", serde_json::to_string_pretty(&json!({
        "agent": cfg.agent_name,
        "wallet": wallet,
        "profile": profile,
    })).unwrap());
}

async fn cmd_heartbeat(cfg: &Config, client: &reqwest::Client) {
    tracing::info!("Heartbeat: verifying profile...");
    cmd_profile(cfg, client).await;
    tracing::info!("Heartbeat: checking balance...");
    let wallet = wallet_snapshot(cfg, client).await;
    tracing::info!(sol = %wallet["sol"], "Balance checked");
    tracing::info!("Heartbeat: posting status...");
    let text = format!("[heartbeat] {} online | SOL: {}", cfg.agent_name, wallet["sol"]);
    cmd_post(cfg, client, &text).await;
    tracing::info!("Heartbeat complete");
}

async fn cmd_discover(cfg: &Config, client: &reqwest::Client) {
    let profiles = tapestry_get(cfg, client, "/profiles/search?query=builder&limit=10").await;
    println!("{}", serde_json::to_string_pretty(&profiles).unwrap());
}

async fn cmd_engage(cfg: &Config, client: &reqwest::Client) {
    let hot = moltbook_get(cfg, client, "/posts/hot?limit=5").await;
    if let Some(posts) = hot.as_array() {
        for post in posts.iter().take(3) {
            if let Some(id) = post["id"].as_str() {
                let reply = moltbook_post(cfg, client, &format!("/posts/{id}/comments"), &json!({
                    "content": format!("Great insight! — {}", cfg.agent_name)
                })).await;
                tracing::info!(post_id = id, "Engaged: {}", reply);
            }
        }
    }
}

async fn cmd_wallet(cfg: &Config, client: &reqwest::Client) {
    let snapshot = wallet_snapshot(cfg, client).await;
    println!("{}", serde_json::to_string_pretty(&snapshot).unwrap());
}

async fn cmd_llm(cfg: &Config, client: &reqwest::Client, prompt: &str) {
    let response = ollama_generate(cfg, client, prompt).await;
    println!("{response}");
}

async fn cmd_dms(cfg: &Config, client: &reqwest::Client) {
    let dms = moltbook_get(cfg, client, "/dms").await;
    println!("{}", serde_json::to_string_pretty(&dms).unwrap());
}

async fn cmd_send_dm(cfg: &Config, client: &reqwest::Client, agent_id: &str, message: &str) {
    let result = moltbook_post(cfg, client, &format!("/dms/{agent_id}"), &json!({"content": message})).await;
    println!("{}", serde_json::to_string_pretty(&result).unwrap());
}

async fn cmd_flash_scan(cfg: &Config, client: &reqwest::Client) {
    let pairs = [("SOL","USDC"),("SOL","USDT"),("SOL","JUP"),("SOL","BONK")];
    let mints: std::collections::HashMap<&str, &str> = [
        ("SOL","So11111111111111111111111111111111111111112"),
        ("USDC","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        ("USDT","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"),
        ("JUP","JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"),
        ("BONK","DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"),
    ].into_iter().collect();

    for (a, b) in &pairs {
        let ma = mints[a]; let mb = mints[b];
        // Forward: A -> B
        let fwd = match client.get(format!(
            "https://lite-api.jup.ag/swap/v1/quote?inputMint={}&outputMint={}&amount=1000000000&slippageBps=50",
            ma, mb)).send().await {
            Ok(r) => r.json::<Value>().await.ok(),
            Err(_) => None,
        };
        // Reverse: B -> A (using output of forward)
        if let Some(ref fq) = fwd {
            let out = fq["outAmount"].as_str().unwrap_or("0");
            let rev = match client.get(format!(
                "https://lite-api.jup.ag/swap/v1/quote?inputMint={}&outputMint={}&amount={}&slippageBps=50",
                mb, ma, out)).send().await {
                Ok(r) => r.json::<Value>().await.ok(),
                Err(_) => None,
            };
            if let Some(rq) = rev {
                let final_amount: f64 = rq["outAmount"].as_str().unwrap_or("0").parse().unwrap_or(0.0);
                let profit_bps = ((final_amount / 1_000_000_000.0) - 1.0) * 10000.0;
                let status = if profit_bps > 5.0 { "OPPORTUNITY" } else { "no-arb" };
                tracing::info!(pair = format!("{a}/{b}"), profit_bps = format!("{profit_bps:.1}"), status);
            }
        }
    }
}

async fn cmd_run(cfg: &Config, client: &reqwest::Client, interval: u64, max_cycles: u64) {
    tracing::info!(interval, max_cycles, "Starting daemon mode");
    for cycle in 1..=max_cycles {
        tracing::info!(cycle, "Running autonomous cycle");
        cmd_heartbeat(cfg, client).await;
        cmd_discover(cfg, client).await;
        cmd_engage(cfg, client).await;
        tracing::info!(cycle, next_in = interval * 60, "Cycle complete");
        if cycle < max_cycles {
            tokio::time::sleep(std::time::Duration::from_secs(interval * 60)).await;
        }
    }
    tracing::info!("Daemon stopped");
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();
    let cli = Cli::parse();
    let cfg = Config::from_env();
    let client = reqwest::Client::builder().user_agent("openpaw/3.0").build().unwrap();

    match cli.command.unwrap_or(Commands::Stats) {
        Commands::Profile => cmd_profile(&cfg, &client).await,
        Commands::Post { text } => cmd_post(&cfg, &client, &text).await,
        Commands::Feed => cmd_feed(&cfg, &client).await,
        Commands::Follow { profile_id } => {
            let r = tapestry_post(&cfg, &client, "/connections", &json!({"startProfileId": cfg.agent_name, "endProfileId": profile_id})).await;
            println!("{}", serde_json::to_string_pretty(&r).unwrap());
        }
        Commands::Balance => cmd_balance(&cfg, &client).await,
        Commands::Swap { from, to, amount } => cmd_swap(&cfg, &client, &from, &to, &amount).await,
        Commands::Stats => cmd_stats(&cfg, &client).await,
        Commands::Heartbeat => cmd_heartbeat(&cfg, &client).await,
        Commands::Discover => cmd_discover(&cfg, &client).await,
        Commands::Engage => cmd_engage(&cfg, &client).await,
        Commands::Run { interval, max_cycles } => cmd_run(&cfg, &client, interval, max_cycles).await,
        Commands::Wallet => cmd_wallet(&cfg, &client).await,
        Commands::Llm { prompt } => cmd_llm(&cfg, &client, &prompt).await,
        Commands::FlashScan => cmd_flash_scan(&cfg, &client).await,
        Commands::Dms => cmd_dms(&cfg, &client).await,
        Commands::SendDm { agent_id, message } => cmd_send_dm(&cfg, &client, &agent_id, &message).await,
    }
}
