// Common Core State Standards for Mathematics, Kindergarten through Grade 8.
//
// This is the curriculum spine. It matters because "Grade 4 mathematics" as a
// free-text topic is a guess, whereas 4.NBT.B.5 is a specific, sequenced,
// nationally recognised skill that a parent or teacher can look up.
//
// Skill descriptions here are concise restatements written for this product, not
// the verbatim standards text. Codes and the domain/cluster structure follow the
// published CCSS-M organisation.
//
// © 2010 National Governors Association Center for Best Practices and Council of
// Chief State School Officers. CCSS-M is published for public use by states and
// providers; the taxonomy is used here with attribution.

export interface StandardSeed {
  code: string;
  grade: string;
  domain: string;
  cluster: string;
  skill: string;
}

const D = (grade: string, domain: string, cluster: string, rows: [string, string][]): StandardSeed[] =>
  rows.map(([code, skill]) => ({ code, grade, domain, cluster, skill }));

export const CCSSM_K8: StandardSeed[] = [
  // ---- Kindergarten ----
  ...D("K", "Counting and Cardinality", "Know number names and the count sequence", [
    ["K.CC.A.1", "Count to 100 by ones and by tens"],
    ["K.CC.A.2", "Count forward from any given number"],
    ["K.CC.A.3", "Write numbers 0 to 20 and represent a count of objects"],
  ]),
  ...D("K", "Counting and Cardinality", "Count to tell the number of objects", [
    ["K.CC.B.4", "Match each object to one number name when counting"],
    ["K.CC.B.5", "Count up to 20 arranged objects and answer how many"],
  ]),
  ...D("K", "Counting and Cardinality", "Compare numbers", [
    ["K.CC.C.6", "Say whether one group has more, fewer or the same as another"],
    ["K.CC.C.7", "Compare two written numbers between 1 and 10"],
  ]),
  ...D("K", "Operations and Algebraic Thinking", "Understand addition and subtraction", [
    ["K.OA.A.1", "Show addition and subtraction with objects, drawings and acting out"],
    ["K.OA.A.2", "Solve addition and subtraction word problems within 10"],
    ["K.OA.A.3", "Break numbers up to 10 into pairs in more than one way"],
    ["K.OA.A.4", "Find the number that makes 10 when added to a given number"],
    ["K.OA.A.5", "Add and subtract fluently within 5"],
  ]),
  ...D("K", "Number and Operations in Base Ten", "Work with numbers 11 to 19", [
    ["K.NBT.A.1", "See the teen numbers as ten ones and some further ones"],
  ]),
  ...D("K", "Measurement and Data", "Describe and compare measurable attributes", [
    ["K.MD.A.1", "Describe measurable attributes such as length and weight"],
    ["K.MD.A.2", "Directly compare two objects by a shared attribute"],
    ["K.MD.B.3", "Sort objects into categories and count how many in each"],
  ]),
  ...D("K", "Geometry", "Identify and describe shapes", [
    ["K.G.A.1", "Name shapes and describe where things are using position words"],
    ["K.G.A.2", "Name shapes regardless of size or orientation"],
    ["K.G.B.4", "Compare two and three dimensional shapes"],
    ["K.G.B.5", "Build and draw shapes"],
  ]),

  // ---- Grade 1 ----
  ...D("1", "Operations and Algebraic Thinking", "Represent and solve problems", [
    ["1.OA.A.1", "Solve add and subtract word problems within 20"],
    ["1.OA.A.2", "Add three whole numbers whose sum is within 20"],
  ]),
  ...D("1", "Operations and Algebraic Thinking", "Understand properties of operations", [
    ["1.OA.B.3", "Use the order of addends and grouping to make adding easier"],
    ["1.OA.B.4", "Understand subtraction as an unknown addend problem"],
  ]),
  ...D("1", "Operations and Algebraic Thinking", "Add and subtract within 20", [
    ["1.OA.C.5", "Relate counting on and counting back to adding and subtracting"],
    ["1.OA.C.6", "Add and subtract within 20, fluently within 10, using make a ten"],
  ]),
  ...D("1", "Operations and Algebraic Thinking", "Work with addition and subtraction equations", [
    ["1.OA.D.7", "Understand what the equals sign means and check if equations are true"],
    ["1.OA.D.8", "Find the missing number in an addition or subtraction equation"],
  ]),
  ...D("1", "Number and Operations in Base Ten", "Place value", [
    ["1.NBT.A.1", "Count to 120 and read and write numerals"],
    ["1.NBT.B.2", "Understand a two digit number as tens and ones"],
    ["1.NBT.B.3", "Compare two digit numbers using >, = and <"],
    ["1.NBT.C.4", "Add within 100 including a two digit number and a one digit number"],
    ["1.NBT.C.5", "Mentally find 10 more or 10 less than a number"],
    ["1.NBT.C.6", "Subtract multiples of 10 from multiples of 10"],
  ]),
  ...D("1", "Measurement and Data", "Measure lengths and tell time", [
    ["1.MD.A.1", "Order three objects by length"],
    ["1.MD.A.2", "Measure length with same size units laid end to end"],
    ["1.MD.B.3", "Tell and write time in hours and half hours"],
    ["1.MD.C.4", "Organise and interpret data with up to three categories"],
  ]),
  ...D("1", "Geometry", "Reason with shapes and their attributes", [
    ["1.G.A.1", "Tell defining attributes of shapes from non defining ones"],
    ["1.G.A.2", "Build larger shapes from smaller shapes"],
    ["1.G.A.3", "Partition circles and rectangles into halves and quarters"],
  ]),

  // ---- Grade 2 ----
  ...D("2", "Operations and Algebraic Thinking", "Add and subtract within 100", [
    ["2.OA.A.1", "Solve one and two step word problems within 100"],
    ["2.OA.B.2", "Fluently add and subtract within 20 from memory"],
    ["2.OA.C.3", "Decide whether a group of objects is odd or even"],
    ["2.OA.C.4", "Use addition to find the total in a rectangular array"],
  ]),
  ...D("2", "Number and Operations in Base Ten", "Understand place value", [
    ["2.NBT.A.1", "Understand three digit numbers as hundreds, tens and ones"],
    ["2.NBT.A.2", "Count within 1000 and skip count by 5s, 10s and 100s"],
    ["2.NBT.A.3", "Read and write numbers to 1000 in several forms"],
    ["2.NBT.A.4", "Compare three digit numbers using >, = and <"],
    ["2.NBT.B.5", "Fluently add and subtract within 100"],
    ["2.NBT.B.7", "Add and subtract within 1000 with regrouping"],
    ["2.NBT.B.8", "Mentally add or subtract 10 or 100"],
  ]),
  ...D("2", "Measurement and Data", "Measure, tell time and use money", [
    ["2.MD.A.1", "Measure length with rulers and other tools"],
    ["2.MD.B.5", "Solve word problems involving lengths"],
    ["2.MD.C.7", "Tell and write time to the nearest five minutes"],
    ["2.MD.C.8", "Solve word problems with dollars, quarters, dimes, nickels and pennies"],
    ["2.MD.D.10", "Draw and interpret picture graphs and bar graphs"],
  ]),
  ...D("2", "Geometry", "Reason with shapes", [
    ["2.G.A.1", "Recognise and draw shapes by their attributes"],
    ["2.G.A.2", "Partition a rectangle into rows and columns of squares"],
    ["2.G.A.3", "Partition shapes into halves, thirds and fourths"],
  ]),

  // ---- Grade 3 ----
  ...D("3", "Operations and Algebraic Thinking", "Multiplication and division meanings", [
    ["3.OA.A.1", "Understand multiplication as equal groups"],
    ["3.OA.A.2", "Understand division as sharing equally or grouping"],
    ["3.OA.A.3", "Solve multiplication and division word problems within 100"],
    ["3.OA.A.4", "Find the unknown number in a multiplication or division equation"],
  ]),
  ...D("3", "Operations and Algebraic Thinking", "Multiply and divide within 100", [
    ["3.OA.B.5", "Use properties of operations to multiply and divide"],
    ["3.OA.B.6", "Understand division as an unknown factor problem"],
    ["3.OA.C.7", "Fluently multiply and divide within 100"],
    ["3.OA.D.8", "Solve two step word problems using the four operations"],
    ["3.OA.D.9", "Identify and explain patterns in arithmetic"],
  ]),
  ...D("3", "Number and Operations in Base Ten", "Place value and multi digit arithmetic", [
    ["3.NBT.A.1", "Round whole numbers to the nearest 10 or 100"],
    ["3.NBT.A.2", "Fluently add and subtract within 1000"],
    ["3.NBT.A.3", "Multiply one digit numbers by multiples of 10"],
  ]),
  ...D("3", "Number and Operations - Fractions", "Understand fractions", [
    ["3.NF.A.1", "Understand a fraction as parts of a whole partitioned equally"],
    ["3.NF.A.2", "Place fractions on a number line"],
    ["3.NF.A.3", "Recognise equivalent fractions and compare fractions"],
  ]),
  ...D("3", "Measurement and Data", "Measurement, area and data", [
    ["3.MD.A.1", "Tell and write time to the nearest minute and find elapsed time"],
    ["3.MD.A.2", "Measure and estimate liquid volumes and masses"],
    ["3.MD.B.3", "Draw and interpret scaled picture and bar graphs"],
    ["3.MD.C.5", "Understand area as covering with unit squares"],
    ["3.MD.C.7", "Relate area to multiplication and addition"],
    ["3.MD.D.8", "Solve problems involving perimeter"],
  ]),
  ...D("3", "Geometry", "Reason with shapes", [
    ["3.G.A.1", "Classify shapes by shared attributes"],
    ["3.G.A.2", "Express parts of a shape as a unit fraction of the whole"],
  ]),

  // ---- Grade 4 ----
  ...D("4", "Operations and Algebraic Thinking", "Use the four operations", [
    ["4.OA.A.1", "Interpret multiplication as a comparison"],
    ["4.OA.A.2", "Solve word problems with multiplicative comparison"],
    ["4.OA.A.3", "Solve multistep word problems including remainders"],
    ["4.OA.B.4", "Find factor pairs, and identify prime and composite numbers"],
    ["4.OA.C.5", "Generate and describe a number or shape pattern"],
  ]),
  ...D("4", "Number and Operations in Base Ten", "Place value and multi digit arithmetic", [
    ["4.NBT.A.1", "Understand that a digit is worth ten times the place to its right"],
    ["4.NBT.A.2", "Read, write and compare multi digit whole numbers"],
    ["4.NBT.A.3", "Round multi digit whole numbers to any place"],
    ["4.NBT.B.4", "Fluently add and subtract multi digit whole numbers"],
    ["4.NBT.B.5", "Multiply up to four digits by one digit, and two digits by two digits"],
    ["4.NBT.B.6", "Divide up to four digit numbers by one digit divisors"],
  ]),
  ...D("4", "Number and Operations - Fractions", "Fractions and decimals", [
    ["4.NF.A.1", "Explain why two fractions are equivalent"],
    ["4.NF.A.2", "Compare fractions with different numerators and denominators"],
    ["4.NF.B.3", "Add and subtract fractions with like denominators"],
    ["4.NF.B.4", "Multiply a fraction by a whole number"],
    ["4.NF.C.5", "Add fractions with denominators 10 and 100"],
    ["4.NF.C.6", "Write fractions with denominator 10 or 100 as decimals"],
    ["4.NF.C.7", "Compare two decimals to hundredths"],
  ]),
  ...D("4", "Measurement and Data", "Measurement, angles and data", [
    ["4.MD.A.1", "Convert measurements within one system of units"],
    ["4.MD.A.2", "Solve word problems involving measurement and money"],
    ["4.MD.A.3", "Apply area and perimeter formulas for rectangles"],
    ["4.MD.C.5", "Understand angles and how they are measured"],
    ["4.MD.C.6", "Measure and draw angles with a protractor"],
    ["4.MD.C.7", "Add and subtract angle measures"],
  ]),
  ...D("4", "Geometry", "Lines, angles and symmetry", [
    ["4.G.A.1", "Draw and identify points, lines, rays and angles"],
    ["4.G.A.2", "Classify two dimensional figures by their lines and angles"],
    ["4.G.A.3", "Recognise lines of symmetry"],
  ]),

  // ---- Grade 5 ----
  ...D("5", "Operations and Algebraic Thinking", "Expressions and patterns", [
    ["5.OA.A.1", "Use parentheses and evaluate numerical expressions"],
    ["5.OA.A.2", "Write and interpret simple numerical expressions"],
    ["5.OA.B.3", "Generate two numerical patterns and compare them"],
  ]),
  ...D("5", "Number and Operations in Base Ten", "Place value with decimals", [
    ["5.NBT.A.1", "Understand place value including decimal places"],
    ["5.NBT.A.3", "Read, write and compare decimals to thousandths"],
    ["5.NBT.A.4", "Round decimals to any place"],
    ["5.NBT.B.5", "Fluently multiply multi digit whole numbers"],
    ["5.NBT.B.6", "Divide with up to four digit dividends and two digit divisors"],
    ["5.NBT.B.7", "Add, subtract, multiply and divide decimals to hundredths"],
  ]),
  ...D("5", "Number and Operations - Fractions", "Fraction operations", [
    ["5.NF.A.1", "Add and subtract fractions with unlike denominators"],
    ["5.NF.A.2", "Solve word problems adding and subtracting fractions"],
    ["5.NF.B.3", "Interpret a fraction as division"],
    ["5.NF.B.4", "Multiply a fraction by a whole number or another fraction"],
    ["5.NF.B.6", "Solve real world problems multiplying fractions"],
    ["5.NF.B.7", "Divide unit fractions by whole numbers and the reverse"],
  ]),
  ...D("5", "Measurement and Data", "Measurement and volume", [
    ["5.MD.A.1", "Convert among different sized units within one system"],
    ["5.MD.B.2", "Make and interpret line plots with fractional units"],
    ["5.MD.C.3", "Understand volume and measure it with unit cubes"],
    ["5.MD.C.5", "Find volumes of right rectangular prisms"],
  ]),
  ...D("5", "Geometry", "Coordinates and classifying figures", [
    ["5.G.A.1", "Understand and use the coordinate plane"],
    ["5.G.A.2", "Represent real world problems by graphing points"],
    ["5.G.B.3", "Understand that attributes of a category belong to all its members"],
    ["5.G.B.4", "Classify two dimensional figures in a hierarchy"],
  ]),

  // ---- Grade 6 ----
  ...D("6", "Ratios and Proportional Relationships", "Understand ratio concepts", [
    ["6.RP.A.1", "Understand the concept of a ratio"],
    ["6.RP.A.2", "Understand unit rate"],
    ["6.RP.A.3", "Solve problems with ratio and rate reasoning, including percent"],
  ]),
  ...D("6", "The Number System", "Fractions, integers and rational numbers", [
    ["6.NS.A.1", "Divide fractions by fractions"],
    ["6.NS.B.2", "Fluently divide multi digit numbers"],
    ["6.NS.B.3", "Fluently add, subtract, multiply and divide decimals"],
    ["6.NS.B.4", "Find greatest common factors and least common multiples"],
    ["6.NS.C.5", "Understand positive and negative numbers in context"],
    ["6.NS.C.6", "Place rational numbers on a number line and coordinate plane"],
    ["6.NS.C.7", "Order rational numbers and understand absolute value"],
  ]),
  ...D("6", "Expressions and Equations", "Expressions, equations and inequalities", [
    ["6.EE.A.1", "Write and evaluate expressions with whole number exponents"],
    ["6.EE.A.2", "Write, read and evaluate expressions with variables"],
    ["6.EE.A.3", "Apply properties of operations to generate equivalent expressions"],
    ["6.EE.B.5", "Understand what solving an equation or inequality means"],
    ["6.EE.B.7", "Solve one step equations with nonnegative rational numbers"],
    ["6.EE.C.9", "Use variables to represent two related quantities"],
  ]),
  ...D("6", "Geometry", "Area, volume and surface area", [
    ["6.G.A.1", "Find areas of triangles and other polygons"],
    ["6.G.A.2", "Find volumes of prisms with fractional edge lengths"],
    ["6.G.A.4", "Use nets to find surface area"],
  ]),
  ...D("6", "Statistics and Probability", "Understand and summarise data", [
    ["6.SP.A.1", "Recognise a statistical question"],
    ["6.SP.B.4", "Display data in plots on a number line"],
    ["6.SP.B.5", "Summarise data by center, spread and shape"],
  ]),

  // ---- Grade 7 ----
  ...D("7", "Ratios and Proportional Relationships", "Proportional relationships", [
    ["7.RP.A.1", "Compute unit rates including with fractions"],
    ["7.RP.A.2", "Recognise and represent proportional relationships"],
    ["7.RP.A.3", "Solve multistep percent problems"],
  ]),
  ...D("7", "The Number System", "Operations with rational numbers", [
    ["7.NS.A.1", "Add and subtract rational numbers including negatives"],
    ["7.NS.A.2", "Multiply and divide rational numbers"],
    ["7.NS.A.3", "Solve real world problems with rational numbers"],
  ]),
  ...D("7", "Expressions and Equations", "Linear expressions and equations", [
    ["7.EE.A.1", "Add, subtract, factor and expand linear expressions"],
    ["7.EE.B.3", "Solve multistep problems with rational numbers"],
    ["7.EE.B.4", "Solve linear equations and inequalities"],
  ]),
  ...D("7", "Geometry", "Scale, constructions and measurement", [
    ["7.G.A.1", "Solve problems involving scale drawings"],
    ["7.G.B.4", "Know and use the formulas for area and circumference of a circle"],
    ["7.G.B.5", "Use angle relationships to solve for unknown angles"],
    ["7.G.B.6", "Solve area, volume and surface area problems"],
  ]),
  ...D("7", "Statistics and Probability", "Sampling, comparison and probability", [
    ["7.SP.A.1", "Understand sampling and representative samples"],
    ["7.SP.B.3", "Compare two data distributions informally"],
    ["7.SP.C.5", "Understand probability as a number between 0 and 1"],
    ["7.SP.C.7", "Develop and use probability models"],
  ]),

  // ---- Grade 8 ----
  ...D("8", "The Number System", "Rational and irrational numbers", [
    ["8.NS.A.1", "Know that numbers that are not rational are irrational"],
    ["8.NS.A.2", "Estimate the value of irrational numbers"],
  ]),
  ...D("8", "Expressions and Equations", "Exponents, roots and linear equations", [
    ["8.EE.A.1", "Apply properties of integer exponents"],
    ["8.EE.A.2", "Use square root and cube root symbols to solve equations"],
    ["8.EE.A.3", "Use scientific notation to express very large or small numbers"],
    ["8.EE.B.5", "Graph proportional relationships and interpret slope"],
    ["8.EE.C.7", "Solve linear equations in one variable"],
    ["8.EE.C.8", "Solve systems of two linear equations"],
  ]),
  ...D("8", "Functions", "Define and compare functions", [
    ["8.F.A.1", "Understand a function as a rule assigning one output to each input"],
    ["8.F.A.2", "Compare properties of two functions represented differently"],
    ["8.F.A.3", "Recognise linear functions and their graphs"],
    ["8.F.B.4", "Construct a function to model a linear relationship"],
  ]),
  ...D("8", "Geometry", "Transformations and the Pythagorean theorem", [
    ["8.G.A.1", "Understand rotations, reflections and translations"],
    ["8.G.A.4", "Understand similarity through transformations"],
    ["8.G.A.5", "Use angle facts about triangles and parallel lines"],
    ["8.G.B.7", "Apply the Pythagorean theorem to find unknown side lengths"],
    ["8.G.C.9", "Find volumes of cones, cylinders and spheres"],
  ]),
  ...D("8", "Statistics and Probability", "Bivariate data", [
    ["8.SP.A.1", "Construct and interpret scatter plots"],
    ["8.SP.A.2", "Fit a straight line to scatter plot data"],
    ["8.SP.A.4", "Understand association in two way tables"],
  ]),
];

/** Everything the spine holds: K-8 plus high school. */
export const CCSSM: StandardSeed[] = [];

// ---- High school ------------------------------------------------------------
//
// CCSS-M does NOT grade-assign high school standards: they are published by
// conceptual category (Number and Quantity, Algebra, Functions, Geometry,
// Statistics and Probability) across the whole 9-12 band. The grade here is the
// TYPICAL US course placement, which is what makes placement, grade-band
// enforcement and the ladder work consistently with K-8:
//   9 = Algebra 1, 10 = Geometry, 11 = Algebra 2, 12 = Precalculus and beyond.
// The codes themselves are the real published ones.

export const CCSSM_HS: StandardSeed[] = [
  // ---- Grade 9, typically Algebra 1 ----
  ...D("9", "Number and Quantity", "The Real Number System", [
    ["HSN.RN.A.1", "Extend exponent rules to rational exponents"],
    ["HSN.RN.A.2", "Rewrite expressions with radicals and rational exponents"],
    ["HSN.RN.B.3", "Explain when sums and products of rationals stay rational"],
  ]),
  ...D("9", "Number and Quantity", "Quantities", [
    ["HSN.Q.A.1", "Use units to guide reasoning and interpret formulas"],
  ]),
  ...D("9", "Algebra", "Seeing Structure in Expressions", [
    ["HSA.SSE.A.1", "Interpret the parts of an expression in context"],
    ["HSA.SSE.A.2", "Rewrite an expression by recognising its structure"],
    ["HSA.SSE.B.3", "Factor or complete the square to reveal properties"],
  ]),
  ...D("9", "Algebra", "Arithmetic with Polynomials", [
    ["HSA.APR.A.1", "Add, subtract and multiply polynomials"],
  ]),
  ...D("9", "Algebra", "Creating Equations", [
    ["HSA.CED.A.1", "Create equations and inequalities in one variable"],
    ["HSA.CED.A.2", "Create equations in two variables and graph them"],
    ["HSA.CED.A.3", "Represent constraints with systems of equations"],
  ]),
  ...D("9", "Algebra", "Reasoning with Equations and Inequalities", [
    ["HSA.REI.A.1", "Justify each step in solving an equation"],
    ["HSA.REI.B.3", "Solve linear equations and inequalities in one variable"],
    ["HSA.REI.B.4", "Solve quadratic equations by factoring, completing the square and the formula"],
    ["HSA.REI.C.6", "Solve systems of linear equations exactly and approximately"],
    ["HSA.REI.D.10", "Understand a graph as the set of solutions to an equation"],
    ["HSA.REI.D.12", "Graph the solutions to a linear inequality"],
  ]),
  ...D("9", "Functions", "Interpreting Functions", [
    ["HSF.IF.A.1", "Understand function notation and what a function is"],
    ["HSF.IF.A.2", "Evaluate functions and interpret them in context"],
    ["HSF.IF.B.4", "Interpret key features of a graph: intercepts, increase, maxima"],
    ["HSF.IF.C.7", "Graph functions and show key features"],
  ]),
  ...D("9", "Functions", "Building Functions", [
    ["HSF.BF.A.1", "Write a function that describes a relationship"],
  ]),
  ...D("9", "Functions", "Linear, Quadratic and Exponential Models", [
    ["HSF.LE.A.1", "Tell linear growth from exponential growth"],
    ["HSF.LE.A.2", "Build linear and exponential functions from data or description"],
  ]),
  ...D("9", "Statistics and Probability", "Interpreting Categorical and Quantitative Data", [
    ["HSS.ID.A.1", "Represent data with dot plots, histograms and box plots"],
    ["HSS.ID.A.2", "Compare center and spread of two data sets"],
    ["HSS.ID.B.6", "Fit a function to data and use it to solve problems"],
    ["HSS.ID.C.7", "Interpret slope and intercept of a linear model in context"],
  ]),

  // ---- Grade 10, typically Geometry ----
  ...D("10", "Geometry", "Congruence", [
    ["HSG.CO.A.1", "Define angle, circle, line, segment and parallel precisely"],
    ["HSG.CO.A.2", "Represent transformations in the plane"],
    ["HSG.CO.B.6", "Use rigid motions to decide whether figures are congruent"],
    ["HSG.CO.C.9", "Prove theorems about lines and angles"],
    ["HSG.CO.C.10", "Prove theorems about triangles"],
    ["HSG.CO.D.12", "Make formal geometric constructions"],
  ]),
  ...D("10", "Geometry", "Similarity, Right Triangles and Trigonometry", [
    ["HSG.SRT.A.2", "Decide whether figures are similar using transformations"],
    ["HSG.SRT.B.5", "Use congruence and similarity criteria to solve problems"],
    ["HSG.SRT.C.6", "Define the trigonometric ratios from similar right triangles"],
    ["HSG.SRT.C.7", "Relate the sine and cosine of complementary angles"],
    ["HSG.SRT.C.8", "Use trigonometric ratios and the Pythagorean theorem in right triangles"],
  ]),
  ...D("10", "Geometry", "Circles", [
    ["HSG.C.A.1", "Prove that all circles are similar"],
    ["HSG.C.B.5", "Relate arc length and sector area to the radius"],
  ]),
  ...D("10", "Geometry", "Expressing Geometric Properties with Equations", [
    ["HSG.GPE.A.1", "Derive and use the equation of a circle"],
    ["HSG.GPE.B.5", "Use slope criteria for parallel and perpendicular lines"],
  ]),
  ...D("10", "Geometry", "Geometric Measurement and Dimension", [
    ["HSG.GMD.A.1", "Explain the formulas for circumference, area and volume"],
    ["HSG.GMD.B.4", "Identify cross sections and solids of revolution"],
  ]),
  ...D("10", "Geometry", "Modeling with Geometry", [
    ["HSG.MG.A.1", "Model real objects with geometric shapes"],
  ]),
  ...D("10", "Statistics and Probability", "Conditional Probability", [
    ["HSS.CP.A.1", "Describe events as subsets of a sample space"],
    ["HSS.CP.A.4", "Build and interpret two way frequency tables"],
    ["HSS.CP.B.7", "Apply the addition rule for probability"],
  ]),

  // ---- Grade 11, typically Algebra 2 ----
  ...D("11", "Number and Quantity", "The Complex Number System", [
    ["HSN.CN.A.1", "Understand complex numbers and the imaginary unit"],
    ["HSN.CN.C.7", "Solve quadratic equations with complex solutions"],
  ]),
  ...D("11", "Algebra", "Seeing Structure in Expressions", [
    ["HSA.SSE.B.4", "Derive and use the formula for a finite geometric series"],
  ]),
  ...D("11", "Algebra", "Arithmetic with Polynomials and Rational Expressions", [
    ["HSA.APR.B.2", "Apply the Remainder Theorem"],
    ["HSA.APR.B.3", "Use zeros of a polynomial to sketch its graph"],
    ["HSA.APR.D.6", "Rewrite rational expressions"],
  ]),
  ...D("11", "Algebra", "Reasoning with Equations and Inequalities", [
    ["HSA.REI.A.2", "Solve rational and radical equations and spot extraneous solutions"],
  ]),
  ...D("11", "Functions", "Interpreting and Building Functions", [
    ["HSF.IF.C.8", "Rewrite a function to reveal maxima, minima and rates"],
    ["HSF.BF.A.2", "Write arithmetic and geometric sequences"],
    ["HSF.BF.B.3", "Understand how transformations change a graph"],
    ["HSF.BF.B.4", "Find inverse functions"],
  ]),
  ...D("11", "Functions", "Linear, Quadratic and Exponential Models", [
    ["HSF.LE.A.4", "Use logarithms to solve exponential equations"],
  ]),
  ...D("11", "Functions", "Trigonometric Functions", [
    ["HSF.TF.A.1", "Understand radian measure"],
    ["HSF.TF.A.2", "Extend trigonometric functions using the unit circle"],
    ["HSF.TF.B.5", "Model periodic phenomena with trigonometric functions"],
    ["HSF.TF.C.8", "Use and apply the Pythagorean identity"],
  ]),
  ...D("11", "Statistics and Probability", "Making Inferences and Justifying Conclusions", [
    ["HSS.IC.A.1", "Understand statistics as inference about a population"],
    ["HSS.IC.B.4", "Use sample data to estimate a population mean or proportion"],
  ]),

  // ---- Grade 12, typically Precalculus and beyond ----
  ...D("12", "Number and Quantity", "Vector and Matrix Quantities", [
    ["HSN.VM.A.1", "Understand vectors as quantities with magnitude and direction"],
    ["HSN.VM.B.4", "Add and subtract vectors"],
    ["HSN.VM.C.6", "Use matrices to represent and manipulate data"],
  ]),
  ...D("12", "Algebra", "Arithmetic with Polynomials", [
    ["HSA.APR.C.4", "Prove and use polynomial identities"],
  ]),
  ...D("12", "Functions", "Trigonometric Functions", [
    ["HSF.TF.B.7", "Use inverse trigonometric functions to solve equations"],
  ]),
  ...D("12", "Geometry", "Expressing Geometric Properties with Equations", [
    ["HSG.GPE.A.2", "Derive the equation of a parabola"],
  ]),
  ...D("12", "Statistics and Probability", "Using Probability to Make Decisions", [
    ["HSS.MD.A.1", "Define a random variable and graph its distribution"],
    ["HSS.MD.B.5", "Weigh expected values to make decisions"],
  ]),
];

// Assembled after both halves are declared.
CCSSM.push(...CCSSM_K8, ...CCSSM_HS);

/**
 * Everyday phrases mapped to standards.
 *
 * The published wording is precise but not what anyone actually types. A parent
 * searches "long division", not "divide up to four digit numbers by one digit
 * divisors"; a child types "times tables", not "fluently multiply within 100".
 * Without this the spine is technically complete and practically unsearchable.
 */
export const ALIASES: Record<string, string[]> = {
  "long division": ["4.NBT.B.6", "5.NBT.B.6", "6.NS.B.2"],
  "times tables": ["3.OA.C.7", "3.OA.A.1"],
  "multiplication tables": ["3.OA.C.7"],
  "carrying": ["2.NBT.B.7", "4.NBT.B.4"],
  "regrouping": ["2.NBT.B.7", "4.NBT.B.4"],
  "borrowing": ["2.NBT.B.7", "4.NBT.B.4"],
  "column addition": ["4.NBT.B.4", "2.NBT.B.5"],
  "telling time": ["1.MD.B.3", "2.MD.C.7", "3.MD.A.1"],
  "clock": ["1.MD.B.3", "2.MD.C.7"],
  "money": ["2.MD.C.8", "4.MD.A.2"],
  "counting": ["K.CC.A.1", "K.CC.B.5", "2.NBT.A.2"],
  "number line": ["3.NF.A.2", "6.NS.C.6", "2.MD.B.5"],
  "place value": ["1.NBT.B.2", "2.NBT.A.1", "4.NBT.A.1", "5.NBT.A.1"],
  "rounding": ["3.NBT.A.1", "4.NBT.A.3", "5.NBT.A.4"],
  "word problems": ["2.OA.A.1", "3.OA.D.8", "4.OA.A.3", "7.EE.B.3"],
  "equivalent fractions": ["3.NF.A.3", "4.NF.A.1"],
  "adding fractions": ["4.NF.B.3", "5.NF.A.1"],
  "dividing fractions": ["5.NF.B.7", "6.NS.A.1"],
  "decimals": ["4.NF.C.6", "5.NBT.A.3", "5.NBT.B.7"],
  "percent": ["6.RP.A.3", "7.RP.A.3"],
  "percentages": ["6.RP.A.3", "7.RP.A.3"],
  "ratios": ["6.RP.A.1", "6.RP.A.2"],
  "negative numbers": ["6.NS.C.5", "7.NS.A.1"],
  "integers": ["6.NS.C.5", "7.NS.A.1"],
  "algebra": ["6.EE.A.2", "6.EE.B.7", "7.EE.B.4", "8.EE.C.7"],
  "solving equations": ["6.EE.B.7", "7.EE.B.4", "8.EE.C.7"],
  "exponents": ["6.EE.A.1", "8.EE.A.1"],
  "square roots": ["8.EE.A.2", "8.NS.A.2"],
  "pythagorean": ["8.G.B.7"],
  "pythagoras": ["8.G.B.7"],
  "area": ["3.MD.C.7", "4.MD.A.3", "6.G.A.1", "7.G.B.4"],
  "perimeter": ["3.MD.D.8", "4.MD.A.3"],
  "volume": ["5.MD.C.5", "6.G.A.2", "8.G.C.9"],
  "angles": ["4.MD.C.6", "4.G.A.1", "7.G.B.5"],
  "shapes": ["K.G.A.2", "2.G.A.1", "3.G.A.1", "5.G.B.4"],
  "graphs": ["2.MD.D.10", "3.MD.B.3", "8.SP.A.1"],
  "coordinate plane": ["5.G.A.1", "6.NS.C.6"],
  "mean average": ["6.SP.B.5"],
  "probability": ["7.SP.C.5", "7.SP.C.7"],
  "slope": ["8.EE.B.5"],
  "functions": ["8.F.A.1", "8.F.B.4"],
  "skip counting": ["2.NBT.A.2", "3.OA.A.1"],
  "odd and even": ["2.OA.C.3"],
  "factors": ["4.OA.B.4", "6.NS.B.4"],
  "prime numbers": ["4.OA.B.4"],

  // High school phrases. These matter more than the K-8 ones: nobody searches
  // "solve quadratic equations by factoring, completing the square and the
  // formula", they search "quadratic formula".
  "quadratic formula": ["HSA.REI.B.4"],
  "quadratics": ["HSA.REI.B.4", "HSA.SSE.B.3"],
  "factoring": ["HSA.SSE.B.3", "HSA.SSE.A.2"],
  "completing the square": ["HSA.SSE.B.3", "HSA.REI.B.4"],
  "polynomials": ["HSA.APR.A.1", "HSA.APR.B.3"],
  "systems of equations": ["HSA.REI.C.6", "8.EE.C.8"],
  "inequalities": ["HSA.REI.D.12", "7.EE.B.4"],
  "slope intercept": ["8.EE.B.5", "HSS.ID.C.7"],
  "function notation": ["HSF.IF.A.1"],
  "graphing functions": ["HSF.IF.C.7", "HSF.BF.B.3"],
  "inverse functions": ["HSF.BF.B.4"],
  "logarithms": ["HSF.LE.A.4"],
  "logs": ["HSF.LE.A.4"],
  "exponential growth": ["HSF.LE.A.1", "HSF.LE.A.2"],
  "sequences": ["HSF.BF.A.2", "HSA.SSE.B.4"],
  "complex numbers": ["HSN.CN.A.1", "HSN.CN.C.7"],
  "imaginary numbers": ["HSN.CN.A.1"],
  "rational exponents": ["HSN.RN.A.1", "HSN.RN.A.2"],
  "radicals": ["HSN.RN.A.2", "HSA.REI.A.2"],
  "trigonometry": ["HSG.SRT.C.6", "HSF.TF.A.2"],
  "trig": ["HSG.SRT.C.6", "HSF.TF.A.2"],
  "sohcahtoa": ["HSG.SRT.C.6", "HSG.SRT.C.8"],
  "unit circle": ["HSF.TF.A.2", "HSF.TF.A.1"],
  "radians": ["HSF.TF.A.1"],
  "sine cosine": ["HSF.TF.A.2", "HSG.SRT.C.6"],
  "geometry proofs": ["HSG.CO.C.9", "HSG.CO.C.10"],
  "congruence": ["HSG.CO.B.6"],
  "similarity": ["HSG.SRT.A.2", "HSG.SRT.B.5"],
  "circle equation": ["HSG.GPE.A.1"],
  "parabola": ["HSG.GPE.A.2", "HSA.REI.B.4"],
  "vectors": ["HSN.VM.A.1", "HSN.VM.B.4"],
  "matrices": ["HSN.VM.C.6"],
  "standard deviation": ["HSS.ID.A.2"],
  "line of best fit": ["HSS.ID.B.6", "8.SP.A.2"],
  "conditional probability": ["HSS.CP.A.1", "HSS.CP.B.7"],
  "algebra 1": ["HSA.REI.B.3", "HSF.IF.A.1", "HSA.CED.A.1"],
  "algebra 2": ["HSA.REI.A.2", "HSF.LE.A.4", "HSN.CN.A.1"],
  "precalculus": ["HSF.TF.A.2", "HSN.VM.A.1"],
};

/**
 * Prerequisite edges: which standards must be solid before another makes sense.
 *
 * CCSS-M publishes the sequence but not explicit prerequisite links, so these
 * edges encode the well-understood domain progressions. They matter because a
 * generated ladder is a fresh guess every time, whereas these are fixed,
 * inspectable, free, and identical for every learner.
 *
 * Only edges where the progression is genuinely clear are listed. Anything not
 * here falls back to generating a ladder, so the map can grow incrementally.
 */
export const PREREQS: Record<string, string[]> = {
  // Place value
  "1.NBT.B.2": ["K.NBT.A.1", "K.CC.A.1"],
  "2.NBT.A.1": ["1.NBT.B.2"],
  "2.NBT.A.4": ["2.NBT.A.1", "1.NBT.B.3"],
  "4.NBT.A.1": ["2.NBT.A.1"],
  "4.NBT.A.2": ["4.NBT.A.1", "2.NBT.A.3"],
  "4.NBT.A.3": ["4.NBT.A.1", "3.NBT.A.1"],
  "5.NBT.A.1": ["4.NBT.A.1"],

  // Addition and subtraction
  "1.OA.C.6": ["K.OA.A.5", "K.OA.A.4"],
  "1.NBT.C.4": ["1.OA.C.6", "1.NBT.B.2"],
  "2.OA.B.2": ["1.OA.C.6"],
  "2.NBT.B.5": ["1.NBT.C.4", "2.OA.B.2"],
  "2.NBT.B.7": ["2.NBT.B.5", "2.NBT.A.1"],
  "3.NBT.A.2": ["2.NBT.B.7"],
  "4.NBT.B.4": ["3.NBT.A.2"],
  "2.OA.A.1": ["1.OA.A.1", "2.NBT.B.5"],

  // Multiplication and division
  "3.OA.A.1": ["2.OA.C.4"],
  "3.OA.A.2": ["3.OA.A.1"],
  "3.OA.A.3": ["3.OA.A.1", "3.OA.A.2"],
  "3.OA.B.6": ["3.OA.A.2"],
  "3.OA.C.7": ["3.OA.A.1", "3.OA.B.5"],
  "3.NBT.A.3": ["3.OA.C.7"],
  "3.OA.D.8": ["3.OA.A.3", "3.NBT.A.2"],
  "4.OA.A.1": ["3.OA.A.1"],
  "4.OA.A.2": ["4.OA.A.1"],
  "4.OA.A.3": ["3.OA.D.8"],
  "4.OA.B.4": ["3.OA.C.7"],
  "4.NBT.B.5": ["3.OA.C.7", "3.NBT.A.3", "4.NBT.A.1"],
  "4.NBT.B.6": ["3.OA.C.7", "4.NBT.B.5"],
  "5.NBT.B.5": ["4.NBT.B.5"],
  "5.NBT.B.6": ["4.NBT.B.6"],
  "6.NS.B.2": ["5.NBT.B.6"],

  // Fractions
  "3.NF.A.1": ["2.G.A.3", "1.G.A.3"],
  "3.NF.A.2": ["3.NF.A.1"],
  "3.NF.A.3": ["3.NF.A.1"],
  "3.G.A.2": ["3.NF.A.1"],
  "4.NF.A.1": ["3.NF.A.3"],
  "4.NF.A.2": ["4.NF.A.1"],
  "4.NF.B.3": ["3.NF.A.1"],
  "4.NF.B.4": ["4.NF.B.3", "3.OA.A.1"],
  "5.NF.A.1": ["4.NF.A.1", "4.NF.B.3"],
  "5.NF.A.2": ["5.NF.A.1"],
  "5.NF.B.3": ["3.OA.A.2", "3.NF.A.1"],
  "5.NF.B.4": ["4.NF.B.4"],
  "5.NF.B.6": ["5.NF.B.4"],
  "5.NF.B.7": ["5.NF.B.4", "3.OA.A.2"],
  "6.NS.A.1": ["5.NF.B.7"],

  // Decimals
  "4.NF.C.5": ["4.NF.B.3"],
  "4.NF.C.6": ["4.NF.C.5", "4.NBT.A.1"],
  "4.NF.C.7": ["4.NF.C.6"],
  "5.NBT.A.3": ["4.NF.C.6", "5.NBT.A.1"],
  "5.NBT.A.4": ["5.NBT.A.3", "4.NBT.A.3"],
  "5.NBT.B.7": ["5.NBT.A.3", "4.NBT.B.4"],
  "6.NS.B.3": ["5.NBT.B.7"],

  // Ratio, rate, percent
  "6.RP.A.1": ["4.OA.A.1", "5.NF.B.4"],
  "6.RP.A.2": ["6.RP.A.1"],
  "6.RP.A.3": ["6.RP.A.1", "6.RP.A.2"],
  "7.RP.A.1": ["6.RP.A.2", "5.NF.B.7"],
  "7.RP.A.2": ["6.RP.A.2"],
  "7.RP.A.3": ["6.RP.A.3"],

  // Negative numbers
  "6.NS.C.5": ["5.G.A.1"],
  "6.NS.C.6": ["6.NS.C.5"],
  "6.NS.C.7": ["6.NS.C.6"],
  "7.NS.A.1": ["6.NS.C.5", "4.NF.B.3"],
  "7.NS.A.2": ["7.NS.A.1", "3.OA.C.7"],
  "7.NS.A.3": ["7.NS.A.2"],

  // Expressions and equations
  "5.OA.A.1": ["3.OA.B.5"],
  "6.EE.A.1": ["3.OA.C.7"],
  "6.EE.A.2": ["5.OA.A.1"],
  "6.EE.A.3": ["6.EE.A.2"],
  "6.EE.B.7": ["6.EE.A.2", "1.OA.D.8"],
  "6.EE.C.9": ["6.EE.A.2"],
  "7.EE.A.1": ["6.EE.A.3", "7.NS.A.2"],
  "7.EE.B.3": ["7.NS.A.3"],
  "7.EE.B.4": ["6.EE.B.7", "7.NS.A.2"],
  "8.EE.C.7": ["7.EE.B.4"],
  "8.EE.C.8": ["8.EE.C.7"],
  "8.EE.A.1": ["6.EE.A.1"],
  "8.EE.A.2": ["8.EE.A.1"],
  "8.EE.A.3": ["8.EE.A.1", "5.NBT.A.1"],
  "8.EE.B.5": ["7.RP.A.2", "5.G.A.1"],

  // Functions
  "8.F.A.1": ["6.EE.C.9"],
  "8.F.A.2": ["8.F.A.1"],
  "8.F.A.3": ["8.F.A.1", "8.EE.B.5"],
  "8.F.B.4": ["8.F.A.3"],

  // Measurement and geometry
  "2.MD.C.7": ["1.MD.B.3"],
  "3.MD.A.1": ["2.MD.C.7"],
  "2.MD.C.8": ["2.NBT.B.5"],
  "4.MD.A.2": ["2.MD.C.8", "4.OA.A.3"],
  "3.MD.C.7": ["3.OA.A.1", "3.MD.C.5"],
  "3.MD.D.8": ["2.MD.B.5"],
  "4.MD.A.3": ["3.MD.C.7", "3.MD.D.8"],
  "6.G.A.1": ["4.MD.A.3"],
  "7.G.B.4": ["6.G.A.1"],
  "7.G.B.6": ["6.G.A.1", "6.G.A.4"],
  "5.MD.C.5": ["5.MD.C.3", "3.MD.C.7"],
  "6.G.A.2": ["5.MD.C.5"],
  "8.G.C.9": ["6.G.A.2", "7.G.B.4"],
  "8.G.B.7": ["8.EE.A.2", "6.G.A.1"],
  "4.G.A.2": ["4.G.A.1", "3.G.A.1"],
  "5.G.B.4": ["4.G.A.2"],
  "5.G.A.2": ["5.G.A.1"],
  "8.G.A.4": ["8.G.A.1", "7.G.A.1"],

  // Data
  "3.MD.B.3": ["2.MD.D.10"],
  "6.SP.B.5": ["6.SP.B.4"],
  "8.SP.A.2": ["8.SP.A.1", "8.EE.B.5"],
};

// ---- high school prerequisite edges -----------------------------------------
// The bridge from Grade 8 into high school matters most: a learner failing
// Algebra 1 very often has an unfinished Grade 6-8 skill underneath it.
Object.assign(PREREQS, {
  // Number and quantity
  "HSN.RN.A.1": ["8.EE.A.1"],
  "HSN.RN.A.2": ["HSN.RN.A.1", "8.EE.A.2"],
  "HSN.RN.B.3": ["HSN.RN.A.1", "8.NS.A.1"],
  "HSN.CN.A.1": ["HSA.REI.B.4", "8.NS.A.1"],
  "HSN.CN.C.7": ["HSN.CN.A.1", "HSA.REI.B.4"],
  "HSN.VM.A.1": ["8.G.A.1", "HSG.SRT.C.6"],
  "HSN.VM.B.4": ["HSN.VM.A.1"],

  // Algebra
  "HSA.SSE.A.1": ["6.EE.A.2", "7.EE.A.1"],
  "HSA.SSE.A.2": ["HSA.SSE.A.1"],
  "HSA.SSE.B.3": ["HSA.SSE.A.2", "HSA.APR.A.1"],
  "HSA.SSE.B.4": ["HSF.BF.A.2", "HSA.SSE.B.3"],
  "HSA.APR.A.1": ["HSA.SSE.A.2", "7.EE.A.1"],
  "HSA.APR.B.2": ["HSA.APR.A.1"],
  "HSA.APR.B.3": ["HSA.APR.B.2", "HSA.SSE.B.3"],
  "HSA.APR.C.4": ["HSA.APR.A.1"],
  "HSA.APR.D.6": ["HSA.APR.A.1", "6.NS.A.1"],
  "HSA.CED.A.1": ["7.EE.B.4", "HSA.SSE.A.1"],
  "HSA.CED.A.2": ["HSA.CED.A.1", "8.F.B.4"],
  "HSA.CED.A.3": ["HSA.CED.A.2", "HSA.REI.C.6"],
  "HSA.REI.A.1": ["8.EE.C.7"],
  "HSA.REI.A.2": ["HSA.APR.D.6", "HSN.RN.A.2"],
  "HSA.REI.B.3": ["8.EE.C.7"],
  "HSA.REI.B.4": ["HSA.REI.B.3", "HSA.SSE.B.3"],
  "HSA.REI.C.6": ["8.EE.C.8", "HSA.REI.B.3"],
  "HSA.REI.D.10": ["8.F.A.3"],
  "HSA.REI.D.12": ["HSA.REI.D.10", "7.EE.B.4"],

  // Functions
  "HSF.IF.A.1": ["8.F.A.1"],
  "HSF.IF.A.2": ["HSF.IF.A.1"],
  "HSF.IF.B.4": ["HSF.IF.A.2", "8.F.A.3"],
  "HSF.IF.C.7": ["HSF.IF.B.4"],
  "HSF.IF.C.8": ["HSF.IF.C.7", "HSA.SSE.B.3"],
  "HSF.BF.A.1": ["HSF.IF.A.2", "8.F.B.4"],
  "HSF.BF.A.2": ["HSF.BF.A.1"],
  "HSF.BF.B.3": ["HSF.IF.C.7"],
  "HSF.BF.B.4": ["HSF.IF.A.1", "HSA.REI.B.3"],
  "HSF.LE.A.1": ["8.F.B.4"],
  "HSF.LE.A.2": ["HSF.LE.A.1", "HSF.BF.A.1"],
  "HSF.LE.A.4": ["HSN.RN.A.2", "HSF.LE.A.2"],
  "HSF.TF.A.1": ["HSG.C.B.5"],
  "HSF.TF.A.2": ["HSF.TF.A.1", "HSG.SRT.C.6"],
  "HSF.TF.B.5": ["HSF.TF.A.2", "HSF.BF.B.3"],
  "HSF.TF.B.7": ["HSF.TF.A.2", "HSF.BF.B.4"],
  "HSF.TF.C.8": ["HSF.TF.A.2"],

  // Geometry
  "HSG.CO.A.1": ["4.G.A.1"],
  "HSG.CO.A.2": ["8.G.A.1"],
  "HSG.CO.B.6": ["HSG.CO.A.2"],
  "HSG.CO.C.9": ["8.G.A.5", "HSG.CO.A.1"],
  "HSG.CO.C.10": ["HSG.CO.C.9"],
  "HSG.CO.D.12": ["HSG.CO.A.1"],
  "HSG.SRT.A.2": ["8.G.A.4"],
  "HSG.SRT.B.5": ["HSG.SRT.A.2", "HSG.CO.B.6"],
  "HSG.SRT.C.6": ["HSG.SRT.A.2"],
  "HSG.SRT.C.7": ["HSG.SRT.C.6"],
  "HSG.SRT.C.8": ["HSG.SRT.C.6", "8.G.B.7"],
  "HSG.C.A.1": ["HSG.SRT.A.2"],
  "HSG.C.B.5": ["HSG.C.A.1", "7.G.B.4"],
  "HSG.GPE.A.1": ["8.G.B.7", "HSA.SSE.B.3"],
  "HSG.GPE.A.2": ["HSG.GPE.A.1"],
  "HSG.GPE.B.5": ["8.EE.B.5", "HSG.CO.A.1"],
  "HSG.GMD.A.1": ["8.G.C.9", "7.G.B.4"],
  "HSG.GMD.B.4": ["HSG.GMD.A.1"],
  "HSG.MG.A.1": ["7.G.B.6"],

  // Statistics and probability
  "HSS.ID.A.1": ["6.SP.B.4"],
  "HSS.ID.A.2": ["HSS.ID.A.1", "6.SP.B.5"],
  "HSS.ID.B.6": ["8.SP.A.2"],
  "HSS.ID.C.7": ["HSS.ID.B.6", "8.EE.B.5"],
  "HSS.CP.A.1": ["7.SP.C.5"],
  "HSS.CP.A.4": ["HSS.CP.A.1", "8.SP.A.4"],
  "HSS.CP.B.7": ["HSS.CP.A.1"],
  "HSS.IC.A.1": ["7.SP.A.1"],
  "HSS.IC.B.4": ["HSS.IC.A.1", "HSS.ID.A.2"],
  "HSS.MD.A.1": ["HSS.CP.A.1", "6.SP.B.5"],
  "HSS.MD.B.5": ["HSS.MD.A.1"],
});
