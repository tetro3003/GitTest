import acm.program.ConsoleProgram;

public class Pr26 extends ConsoleProgram{
	
	public void run(){
		
		int num1 = readInt("Enter Number N1: ");
		int num2 = readInt("Enter Number N2: ");
		
		usg(num1, num2);
		
	}
	
	private void usg(int a, int b){
		
		for(int c=a; c>0; c--){
			
			if((a%c==0)&&(b%c==0))
				{
				println(c);
				break;
				}
		}
		
	}
	
}
