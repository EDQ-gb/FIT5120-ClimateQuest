param(
    [string]$TrainCsv = "../Cooking_Dataset/train.csv",
    [string]$OutputDir = "../ingredient_assets",
    [int]$Top = 300,
    [int]$MinCount = 20
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$trainPath = Resolve-Path -LiteralPath (Join-Path $scriptDir $TrainCsv)
$outputPath = Join-Path $scriptDir $OutputDir
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$code = @"
using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;

public static class IngredientVocabBuilder
{
    class Entry
    {
        public string Name = "";
        public int Count = 0;
        public List<string> Examples = new List<string>();
    }

    static readonly Dictionary<string, string> Synonyms = new Dictionary<string, string> {
        {"catsup", "ketchup"}, {"catchup", "ketchup"}, {"green onions", "scallion"},
        {"green onion", "scallion"}, {"scallions", "scallion"}, {"spring onions", "scallion"},
        {"spring onion", "scallion"}, {"bell peppers", "bell pepper"}, {"green peppers", "bell pepper"},
        {"green pepper", "bell pepper"}, {"red peppers", "bell pepper"}, {"red pepper", "bell pepper"},
        {"capsicum", "bell pepper"}, {"hamburger", "ground beef"}, {"ground round", "ground beef"},
        {"minced beef", "ground beef"}, {"confectioners sugar", "powdered sugar"},
        {"confectioner sugar", "powdered sugar"}, {"icing sugar", "powdered sugar"},
        {"caster sugar", "white sugar"}, {"granulated sugar", "white sugar"},
        {"mayo", "mayonnaise"}, {"miracle whip", "mayonnaise"}, {"oleo", "margarine"},
        {"condensed milk", "sweetened condensed milk"}, {"sweet condensed milk", "sweetened condensed milk"},
        {"semi sweet chocolate chips", "chocolate chips"}, {"semisweet chocolate chips", "chocolate chips"},
        {"choc chips", "chocolate chips"}, {"macaroni noodles", "macaroni"},
        {"elbow macaroni", "macaroni"}, {"spaghetti noodles", "spaghetti"},
        {"boiling water", "water"}, {"cold water", "water"}, {"hot water", "water"},
        {"warm water", "water"}, {"all purpose flour", "flour"},
        {"plain flour", "flour"}, {"butter margarine", "butter"},
        {"margarine butter", "butter"}, {"salt pepper", "salt and pepper"}
    };

    static readonly string[] ProtectedPhrases = {
        "cream cheese", "sour cream", "ice cream", "whipping cream", "heavy cream",
        "cream of mushroom soup", "cream of chicken soup", "cream of celery soup",
        "brown sugar", "powdered sugar", "white sugar", "baking powder", "baking soda",
        "soy sauce", "worcestershire sauce", "tomato sauce", "tomato paste",
        "chili powder", "garlic powder", "onion powder", "lemon juice", "lime juice",
        "orange juice", "apple cider vinegar", "peanut butter", "olive oil",
        "vegetable oil", "ground beef", "ground pork", "ground turkey",
        "chicken breast", "chicken breasts", "chicken broth", "beef broth",
        "chicken stock", "beef stock", "bread crumbs", "bread crumb", "corn syrup",
        "maple syrup", "vanilla extract", "almond extract", "cheddar cheese",
        "parmesan cheese", "mozzarella cheese", "swiss cheese", "cottage cheese",
        "rice krispies", "cool whip"
    };

    static readonly HashSet<string> Units = new HashSet<string>(new [] {
        "c", "cup", "cups", "tbsp", "tablespoon", "tablespoons", "tsp", "teaspoon",
        "teaspoons", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
        "pkg", "pkgs", "package", "packages", "can", "cans", "jar", "jars",
        "box", "boxes", "bag", "bags", "bottle", "bottles", "qt", "quart", "quarts",
        "pt", "pint", "pints", "gal", "gallon", "gallons", "dash", "pinch",
        "slice", "slices", "stick", "sticks", "bunch", "head", "clove", "cloves"
    });

    static readonly HashSet<string> Modifiers = new HashSet<string>(new [] {
        "fresh", "frozen", "canned", "dry", "dried", "large", "medium", "small",
        "extra", "lean", "ripe", "firmly", "packed", "softened", "melted", "cubed",
        "chopped", "diced", "sliced", "minced", "crushed", "grated", "shredded",
        "drained", "rinsed", "beaten", "cooked", "uncooked", "peeled", "seeded",
        "optional", "divided", "prepared", "instant", "whole", "halved", "quartered",
        "bite", "size", "to", "taste", "your", "choice", "boiling", "cold", "hot",
        "warm", "all", "purpose", "plain"
    });

    static readonly HashSet<string> Skip = new HashSet<string>(new [] {
        "and", "or", "of", "for", "with", "without", "in", "more", "less"
    });

    public static void Build(string trainPath, string outputPath, int top, int minCount)
    {
        var counts = new Dictionary<string, Entry>();
        int rows = 0;
        int ingredientMentions = 0;
        using (var reader = new StreamReader(trainPath, Encoding.UTF8))
        {
            string header = reader.ReadLine();
            string line;
            while ((line = reader.ReadLine()) != null)
            {
                rows++;
                var fields = ParseCsvLine(line);
                if (fields.Count < 2) continue;
                foreach (Match m in Regex.Matches(fields[1], "\"((?:[^\"\\\\]|\\\\.)*)\""))
                {
                    string raw = m.Groups[1].Value.Replace("\\\"", "\"");
                    ingredientMentions++;
                    string name = Normalize(raw);
                    if (String.IsNullOrWhiteSpace(name)) continue;
                    Entry entry;
                    if (!counts.TryGetValue(name, out entry))
                    {
                        entry = new Entry { Name = name };
                        counts[name] = entry;
                    }
                    entry.Count++;
                    if (entry.Examples.Count < 5 && !entry.Examples.Contains(raw)) entry.Examples.Add(raw);
                }
            }
        }

        var candidates = counts.Values
            .Where(e => e.Count >= minCount)
            .OrderByDescending(e => e.Count)
            .ThenBy(e => e.Name)
            .Take(top)
            .ToList();

        Directory.CreateDirectory(outputPath);
        WriteCsv(Path.Combine(outputPath, "ingredient_candidates.csv"), candidates);
        WriteJson(Path.Combine(outputPath, "ingredient_pool.json"), candidates, rows, ingredientMentions, top, minCount);
        WriteSynonyms(Path.Combine(outputPath, "ingredient_synonyms.json"));
        WriteSummary(Path.Combine(outputPath, "ingredient_vocab_summary.txt"), trainPath, candidates, rows, ingredientMentions, top, minCount);
    }

    static List<string> ParseCsvLine(string line)
    {
        var fields = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;
        for (int i = 0; i < line.Length; i++)
        {
            char ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"') { sb.Append('"'); i++; }
                else inQuotes = !inQuotes;
            }
            else if (ch == ',' && !inQuotes)
            {
                fields.Add(sb.ToString());
                sb.Clear();
            }
            else sb.Append(ch);
        }
        fields.Add(sb.ToString());
        return fields;
    }

    static string Normalize(string raw)
    {
        string text = raw.ToLowerInvariant().Replace("&", " and ");
        text = Regex.Replace(text, "\\(.*?\\)", " ");
        text = Regex.Replace(text, "\\b\\d+\\s*(/|-|to)\\s*\\d+\\b", " ");
        text = Regex.Replace(text, "\\b\\d+([./]\\d+)?\\b", " ");
        text = Regex.Replace(text, "\\b(one|two|three|four|five|six|seven|eight|nine|ten)\\b", " ");
        text = Regex.Replace(text, "[^a-z ]", " ");
        text = Regex.Replace(text, "\\s+", " ").Trim();
        if (text.Length == 0) return null;

        foreach (var phrase in ProtectedPhrases)
        {
            if (Regex.IsMatch(text, "\\b" + Regex.Escape(phrase) + "\\b"))
            {
                string protectedName = Singular(phrase);
                return Synonyms.ContainsKey(protectedName) ? Synonyms[protectedName] : protectedName;
            }
        }

        var tokens = new List<string>();
        foreach (var token in text.Split(' '))
        {
            if (token.Length <= 1) continue;
            if (Units.Contains(token) || Modifiers.Contains(token) || Skip.Contains(token)) continue;
            tokens.Add(token);
        }
        if (tokens.Count == 0) return null;
        string canonical = Singular(String.Join(" ", tokens));
        if (canonical.Length < 2) return null;
        return Synonyms.ContainsKey(canonical) ? Synonyms[canonical] : canonical;
    }

    static string Singular(string text)
    {
        var words = text.Split(' ');
        if (words.Length == 0) return text;
        string last = words[words.Length - 1];
        if (last.EndsWith("ies")) last = last.Substring(0, last.Length - 3) + "y";
        else if (last.EndsWith("oes")) last = last.Substring(0, last.Length - 2);
        else if (last.EndsWith("ses")) last = last.Substring(0, last.Length - 2);
        else if (last.EndsWith("s") && !last.EndsWith("ss") && !last.EndsWith("us")) last = last.Substring(0, last.Length - 1);
        words[words.Length - 1] = last;
        return String.Join(" ", words);
    }

    static string Csv(string value)
    {
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }

    static string Json(string value)
    {
        return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    static void WriteCsv(string path, List<Entry> entries)
    {
        using (var writer = new StreamWriter(path, false, new UTF8Encoding(false)))
        {
            writer.WriteLine("ingredient,count,examples");
            foreach (var e in entries)
            {
                writer.WriteLine(Csv(e.Name) + "," + e.Count + "," + Csv(String.Join(" | ", e.Examples)));
            }
        }
    }

    static void WriteJson(string path, List<Entry> entries, int rows, int mentions, int top, int minCount)
    {
        using (var writer = new StreamWriter(path, false, new UTF8Encoding(false)))
        {
            writer.WriteLine("{");
            writer.WriteLine("  \"source\": \"Cooking_Dataset/train.csv\",");
            writer.WriteLine("  \"total_rows\": " + rows + ",");
            writer.WriteLine("  \"total_ingredient_mentions\": " + mentions + ",");
            writer.WriteLine("  \"top_n\": " + top + ",");
            writer.WriteLine("  \"min_count\": " + minCount + ",");
            writer.WriteLine("  \"ingredients\": [");
            for (int i = 0; i < entries.Count; i++)
            {
                var e = entries[i];
                writer.WriteLine("    { \"name\": " + Json(e.Name) + ", \"count\": " + e.Count + ", \"examples\": [" + String.Join(", ", e.Examples.Select(Json)) + "] }" + (i == entries.Count - 1 ? "" : ","));
            }
            writer.WriteLine("  ]");
            writer.WriteLine("}");
        }
    }

    static void WriteSynonyms(string path)
    {
        using (var writer = new StreamWriter(path, false, new UTF8Encoding(false)))
        {
            writer.WriteLine("{");
            int i = 0;
            foreach (var kv in Synonyms.OrderBy(k => k.Key))
            {
                writer.WriteLine("  " + Json(kv.Key) + ": " + Json(kv.Value) + (i == Synonyms.Count - 1 ? "" : ","));
                i++;
            }
            writer.WriteLine("}");
        }
    }

    static void WriteSummary(string path, string trainPath, List<Entry> entries, int rows, int mentions, int top, int minCount)
    {
        int coverage = entries.Sum(e => e.Count);
        double pct = mentions == 0 ? 0 : Math.Round(100.0 * coverage / mentions, 2);
        using (var writer = new StreamWriter(path, false, new UTF8Encoding(false)))
        {
            writer.WriteLine("Ingredient vocabulary build summary");
            writer.WriteLine("source: " + trainPath);
            writer.WriteLine("rows: " + rows);
            writer.WriteLine("ingredient mentions: " + mentions);
            writer.WriteLine("candidate ingredients: " + entries.Count);
            writer.WriteLine("min count: " + minCount);
            writer.WriteLine("top N: " + top);
            writer.WriteLine("top candidate mention coverage: " + coverage + " (" + pct + "%)");
            writer.WriteLine();
            writer.WriteLine("Top 30 ingredients:");
            foreach (var e in entries.Take(30)) writer.WriteLine(e.Name + "\t" + e.Count);
        }
    }
}
"@

Add-Type -TypeDefinition $code -Language CSharp
[IngredientVocabBuilder]::Build([string]$trainPath, [string]$outputPath, $Top, $MinCount)

Write-Output "Wrote ingredient assets to $outputPath"
