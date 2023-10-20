import acm.program.ConsoleProgram;

public class Pr29 extends ConsoleProgram{
	
	public void run(){
		
	int a = readInt("Enter Number: ");
	
	int b = 1;
	int c = 1;
	int fibo = 0;
	
	for(int d=0; d < a; d++){
		
		c = fibo;
		
		fibo = b + fibo;
		
		b = c;
	}
	
	println(fibo);
}
}